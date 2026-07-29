import { SQSHandler } from "aws-lambda";
import { Repo } from "../data/repo";
import { PaymentEvent } from "../payments/provider";
import { markOrderPaidAndOpenCards } from "../fulfillment/on-paid";
import { dispatchDelivery } from "../fulfillment/deliver";
import { CardState, isTerminal } from "../domain/states";
import { newEventId } from "../domain/tokens";

const repo = new Repo(requireEnv("TABLE_NAME"));
const WEB_BASE_URL = requireEnv("WEB_BASE_URL");

/**
 * SQS-triggered processor for normalized payment events (handoff §6.2).
 * Idempotent by Stripe event id — a redelivered event is skipped. Batches
 * partial-fail: a throwing record is retried without reprocessing its siblings.
 */
export const handler: SQSHandler = async (event) => {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const evt = JSON.parse(record.body) as PaymentEvent;

      const fresh = await repo.markEventProcessed(evt.eventId);
      if (!fresh) {
        continue; // already handled
      }

      if (evt.kind === "CHECKOUT_COMPLETED") {
        await handleCheckoutCompleted(evt);
      } else if (evt.kind === "REFUNDED") {
        await handleRefunded(evt);
      }
    } catch (e) {
      console.error("processing failed for message", record.messageId, e);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};

async function handleCheckoutCompleted(
  evt: Extract<PaymentEvent, { kind: "CHECKOUT_COMPLETED" }>,
): Promise<void> {
  const found = await repo.getOrderWithCards(evt.orderId);
  if (!found) {
    console.warn("checkout.completed for unknown order", evt.orderId);
    return;
  }
  const issued = await markOrderPaidAndOpenCards(repo, found.order, found.cards, {
    paymentIntentId: evt.paymentIntentId,
    sessionId: evt.sessionId,
  });
  for (const { card, token } of issued) {
    await dispatchDelivery(card, token, WEB_BASE_URL);
  }
}

async function handleRefunded(
  evt: Extract<PaymentEvent, { kind: "REFUNDED" }>,
): Promise<void> {
  if (!evt.orderId) {
    console.warn("refund without orderId — skipping (admin refund flow is M6)");
    return;
  }
  const found = await repo.getOrderWithCards(evt.orderId);
  if (!found) return;

  await repo.saveOrder({ ...found.order, status: "REFUNDED", updatedAt: new Date().toISOString() });
  for (const card of found.cards) {
    if (isTerminal(card.state)) continue;
    const ts = new Date().toISOString();
    await repo.transitionCard({
      card,
      to: CardState.REFUNDED,
      actor: "stripe",
      reason: "charge refunded",
      event: {
        eventId: newEventId(),
        cardId: card.cardId,
        orderId: card.orderId,
        actor: "stripe",
        from: card.state,
        to: CardState.REFUNDED,
        reason: "charge refunded",
        timestamp: ts,
      },
    });
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

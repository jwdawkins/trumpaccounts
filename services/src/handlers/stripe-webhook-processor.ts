import { SQSHandler } from "aws-lambda";
import { Repo } from "../data/repo";
import { PaymentEvent } from "../payments/provider";
import { markOrderPaidAndOpenCards } from "../fulfillment/on-paid";
import { dispatchDelivery } from "../fulfillment/deliver";
import { buildOrderSummaryHtml } from "../notify/email";
import { sendBrevoEmail } from "../notify/brevo";
import { getCertificate } from "../notify/store";
import { CardState, isTerminal } from "../domain/states";
import { newEventId } from "../domain/tokens";

const repo = new Repo(requireEnv("TABLE_NAME"));
const WEB_BASE_URL = requireEnv("WEB_BASE_URL");
const ASSETS_BUCKET = requireEnv("ASSETS_BUCKET");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

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
    const { emailSent } = await dispatchDelivery(card, token, WEB_BASE_URL);
    if (emailSent) {
      const now = new Date().toISOString();
      await repo.saveCard({ ...card, deliverySentAt: now, updatedAt: now });
    }
  }

  // One order-summary email to the buyer, with a status link. Best-effort — a
  // failure here must not fail the webhook (fulfillment already succeeded).
  if (found.order.buyerEmail) {
    try {
      const attachments: { name: string; content: string }[] = [];
      for (let i = 0; i < found.cards.length; i++) {
        const c = found.cards[i];
        const pdf = await getCertificate(ASSETS_BUCKET, c.cardId);
        if (pdf) {
          const label = c.recipientName ? slug(c.recipientName) : `card-${i + 1}`;
          attachments.push({ name: `gift-${label}.pdf`, content: Buffer.from(pdf).toString("base64") });
        }
      }
      await sendBrevoEmail({
        to: found.order.buyerEmail,
        subject: "Your gift order is confirmed",
        html: buildOrderSummaryHtml({
          statusUrl: `${WEB_BASE_URL.replace(/\/$/, "")}/orders/${found.order.orderId}`,
          cards: found.cards.map((c) => ({
            recipientName: c.recipientName,
            amountCents: c.totalAmount,
            trumpPercent: c.trumpPercent,
            brandName: c.brandName,
            deliveryMethod: c.deliveryMethod,
            recipientEmail: c.recipientEmail,
            recipientPhone: c.recipientPhone,
            sendDate: c.sendDate,
          })),
        }),
        attachments: attachments.length ? attachments : undefined,
      });
    } catch (e) {
      console.warn(JSON.stringify({ msg: "buyer summary email failed", orderId: found.order.orderId, error: (e as Error).message }));
    }
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

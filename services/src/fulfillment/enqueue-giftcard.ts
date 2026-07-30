import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Repo } from "../data/repo";
import { Card } from "../domain/types";
import { GiftCardLeg } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { trumpLegAllowsOrdering } from "./order-giftcard";

const ORDER_BEFORE_VERIFY = process.env.ORDER_GIFTCARD_BEFORE_VERIFY === "true";

export type EnqueueResult = "enqueued" | "not-ready" | "already";

/**
 * Auto-enqueue the gift-card order when the card is ready (§6.3): a product is
 * selected AND the Trump leg is VERIFIED (unless ORDER_GIFTCARD_BEFORE_VERIFY).
 * Sets giftCardLeg = ORDERED and hands the job to the async order-worker. Safe to
 * call from multiple triggers (claim-select, the funding worker) — idempotent via
 * the SELECTED→ORDERED guard. Best-effort: callers ignore the result.
 */
export async function enqueueGiftCardOrderIfReady(
  repo: Repo,
  sqs: SQSClient,
  queueUrl: string,
  card: Card,
  actor: string,
): Promise<EnqueueResult> {
  if (card.giftCardLeg === GiftCardLeg.DELIVERED || card.giftCardLeg === GiftCardLeg.ORDERED || card.tremendousOrderId) {
    return "already";
  }
  // Only SELECTED (or FAILED, for a retry) with a product chosen is orderable.
  if (card.giftCardLeg !== GiftCardLeg.SELECTED && card.giftCardLeg !== GiftCardLeg.FAILED) return "not-ready";
  if (!card.selectedGiftCardProduct) return "not-ready";
  if (!ORDER_BEFORE_VERIFY && !trumpLegAllowsOrdering(card.trumpLeg)) return "not-ready";

  const now = new Date().toISOString();
  await repo.saveCard({ ...card, giftCardLeg: GiftCardLeg.ORDERED, updatedAt: now });
  await repo.appendEvent({
    eventId: newEventId(), cardId: card.cardId, orderId: card.orderId, actor,
    leg: "giftCard", reason: "gift card order auto-enqueued", timestamp: now,
  });
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ cardId: card.cardId }),
      MessageGroupId: card.cardId,
      MessageDeduplicationId: `${card.cardId}:auto:${now}`,
    }),
  );
  return "enqueued";
}

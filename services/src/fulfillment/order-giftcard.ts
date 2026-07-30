import { Repo } from "../data/repo";
import { Card } from "../domain/types";
import { CardState, GiftCardLeg, TrumpLeg, legsSatisfyComplete, isTerminal } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { GiftCardOrderer, GiftCardDelivery } from "../giftcards/provider";
import { recipientDenominationCents } from "../giftcards/fees";

export type OrderOutcome =
  | { status: "delivered"; completed: boolean; tremendousOrderId: string; link?: string }
  | { status: "skipped"; reason: string } // idempotent no-op
  | { status: "failed_permanent"; reason: string }; // marked FAILED, do not retry

/** A 4xx from the provider is a permanent (poison) failure; anything else retries. */
function isPermanent(e: unknown): boolean {
  const status = (e as { status?: number }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * Place the Tremendous reward order for a card and advance its gift-card leg.
 * Runs ONLY in the async order-worker (holds the order key). Idempotent: a card
 * already DELIVERED (or carrying a tremendousOrderId) is skipped; the provider is
 * also called with external_id=cardId so a retried message can't double-order.
 * Transient failures throw (SQS retries); a 4xx marks the leg FAILED and returns.
 */
export async function placeGiftCardOrder(
  repo: Repo,
  orderer: GiftCardOrderer,
  cardId: string,
  overrideEmail?: string,
): Promise<OrderOutcome> {
  const card = await repo.getCard(cardId);
  if (!card) return { status: "skipped", reason: "card not found" };
  if (card.giftCardLeg === GiftCardLeg.DELIVERED || card.tremendousOrderId) {
    return { status: "skipped", reason: "already fulfilled" };
  }
  if (card.giftCardLeg !== GiftCardLeg.ORDERED) {
    // Worker only runs after enqueue set ORDERED; anything else is stale.
    return { status: "skipped", reason: `unexpected giftCardLeg ${card.giftCardLeg}` };
  }
  if (!card.selectedGiftCardProduct || card.giftCardAmount <= 0) {
    await markFailed(repo, card, "no product selected or zero amount");
    return { status: "failed_permanent", reason: "no product/amount" };
  }

  const recipientEmail = card.recipientEmail ?? overrideEmail;
  const delivery: GiftCardDelivery = recipientEmail ? "EMAIL" : "LINK";
  // Reduce the recipient's payout by the fee for cash-out types so our cost stays
  // at the budgeted gift amount (fee-free types get the full amount).
  const denomination = recipientDenominationCents(card.selectedGiftCardCategory, card.giftCardAmount);

  let order;
  try {
    order = await orderer.createOrder({
      externalId: cardId, // idempotency at the provider
      productId: card.selectedGiftCardProduct,
      amountCents: denomination,
      recipientName: card.recipientName ?? "Gift recipient",
      recipientEmail,
      delivery,
    });
  } catch (e) {
    if (isPermanent(e)) {
      await markFailed(repo, card, `provider rejected order: ${(e as Error).message}`);
      return { status: "failed_permanent", reason: (e as Error).message };
    }
    throw e; // transient — let SQS retry
  }

  const now = new Date().toISOString();
  const patch: Partial<Card> = {
    giftCardLeg: GiftCardLeg.DELIVERED,
    tremendousOrderId: order.orderId,
    tremendousRewardId: order.rewardId,
    ...(order.link ? { tremendousRewardLink: order.link } : {}),
    ...(order.feeCents !== undefined ? { tremendousFeeCents: order.feeCents } : {}),
    ...(order.recipientCents !== undefined ? { tremendousRecipientCents: order.recipientCents } : {}),
  };
  const feeNote = order.feeCents ? `, fee ${order.feeCents}¢` : "";
  const reason = `gift card ordered via Tremendous (${order.orderId}, ${delivery}, net ${order.recipientCents ?? denomination}¢${feeNote})`;
  const completes = legsSatisfyComplete(GiftCardLeg.DELIVERED, card.trumpLeg) && !isTerminal(card.state);

  if (completes) {
    await repo.transitionCard({
      card, to: CardState.COMPLETE, actor: "system:giftcard-worker",
      reason: "gift card delivered; both legs complete", patch,
      event: mkEvent(card, CardState.COMPLETE, now, reason),
    });
  } else {
    await repo.saveCard({ ...card, ...patch, updatedAt: now });
    await repo.appendEvent(mkEvent(card, undefined, now, reason));
  }

  return { status: "delivered", completed: completes, tremendousOrderId: order.orderId, link: order.link };
}

async function markFailed(repo: Repo, card: Card, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await repo.saveCard({ ...card, giftCardLeg: GiftCardLeg.FAILED, updatedAt: now });
  await repo.appendEvent(mkEvent(card, undefined, now, `gift card order FAILED: ${reason}`));
}

function mkEvent(card: Card, to: CardState | undefined, timestamp: string, reason: string) {
  return {
    eventId: newEventId(),
    cardId: card.cardId,
    orderId: card.orderId,
    actor: "system:giftcard-worker",
    from: to ? card.state : undefined,
    to,
    leg: "giftCard" as const,
    reason,
    timestamp,
  };
}

/** Trump-leg guard shared with the enqueue path (§6.3): don't order before VERIFIED. */
export function trumpLegAllowsOrdering(trumpLeg: TrumpLeg): boolean {
  return trumpLeg === TrumpLeg.VERIFIED || trumpLeg === TrumpLeg.TRANSFERRED;
}

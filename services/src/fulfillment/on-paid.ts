import { Repo } from "../data/repo";
import { Order, Card } from "../domain/types";
import { CardState } from "../domain/states";
import { issueClaimToken, newEventId } from "../domain/tokens";

export interface IssuedCard {
  /** The updated card (state OPEN, hash stored). */
  card: Card;
  /** Raw claim token — deliver it, then discard. NEVER persisted (§8). */
  token: string;
}

/**
 * On payment success (handoff §6.2): mark the order PAID, transition each
 * still-unpaid card PENDING_PAYMENT -> OPEN, and issue a claim token per card
 * (only the hash is stored). Idempotent: cards already past PENDING_PAYMENT are
 * skipped, so a redelivered webhook won't re-issue tokens.
 *
 * Returns the freshly-issued (card, rawToken) pairs for delivery dispatch.
 */
export async function markOrderPaidAndOpenCards(
  repo: Repo,
  order: Order,
  cards: Card[],
  opts: { paymentIntentId?: string; sessionId?: string; now?: Date },
): Promise<IssuedCard[]> {
  const now = opts.now ?? new Date();
  const iso = now.toISOString();

  await repo.saveOrder({
    ...order,
    status: "PAID",
    stripePaymentIntentId: opts.paymentIntentId ?? order.stripePaymentIntentId,
    stripeCheckoutSessionId: opts.sessionId ?? order.stripeCheckoutSessionId,
    updatedAt: iso,
  });

  const issued: IssuedCard[] = [];
  for (const card of cards) {
    if (card.state !== CardState.PENDING_PAYMENT) continue; // idempotent skip
    const { token, hash } = issueClaimToken();
    await repo.transitionCard({
      card,
      to: CardState.OPEN,
      actor: "stripe",
      reason: "payment succeeded",
      patch: { claimTokenHash: hash },
      event: {
        eventId: newEventId(),
        cardId: card.cardId,
        orderId: card.orderId,
        actor: "stripe",
        from: card.state,
        to: CardState.OPEN,
        reason: "payment succeeded",
        timestamp: iso,
      },
    });
    issued.push({ card: { ...card, state: CardState.OPEN, claimTokenHash: hash }, token });
  }
  return issued;
}

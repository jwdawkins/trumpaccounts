import { describe, it, expect } from "vitest";
import { markOrderPaidAndOpenCards } from "../src/fulfillment/on-paid";
import { buildOrderFromCart } from "../src/domain/cart";
import { CardState } from "../src/domain/states";
import { hashClaimToken } from "../src/domain/tokens";
import type { Repo } from "../src/data/repo";
import type { Order, Card } from "../src/domain/types";

/** In-memory fake of the bits of Repo that on-paid touches. */
function fakeRepo() {
  const saved: Order[] = [];
  const transitions: { cardId: string; to: CardState; hash?: string }[] = [];
  const repo = {
    async saveOrder(o: Order) {
      saved.push(o);
    },
    async transitionCard(p: { card: Card; to: CardState; patch?: Partial<Card> }) {
      transitions.push({ cardId: p.card.cardId, to: p.to, hash: p.patch?.claimTokenHash });
    },
  } as unknown as Repo;
  return { repo, saved, transitions };
}

describe("markOrderPaidAndOpenCards (§6.2)", () => {
  it("marks order PAID and opens every pending card with a stored token hash", async () => {
    const { order, cards } = buildOrderFromCart("buyer-1", [
      { totalAmount: 10000, trumpPercent: 50, deliveryMethod: "SELF" },
      { totalAmount: 8000, trumpPercent: 100, deliveryMethod: "SELF" },
    ]);
    const { repo, saved, transitions } = fakeRepo();

    const issued = await markOrderPaidAndOpenCards(repo, order, cards, {
      paymentIntentId: "pi_123",
      sessionId: "cs_123",
    });

    expect(saved[0].status).toBe("PAID");
    expect(saved[0].stripePaymentIntentId).toBe("pi_123");
    expect(issued).toHaveLength(2);
    // every transition is to OPEN and stores the HASH of the returned raw token
    for (const { card, token } of issued) {
      const t = transitions.find((x) => x.cardId === card.cardId)!;
      expect(t.to).toBe(CardState.OPEN);
      expect(t.hash).toBe(hashClaimToken(token));
    }
  });

  it("is idempotent — cards already past PENDING_PAYMENT are not re-issued", async () => {
    const { order, cards } = buildOrderFromCart("buyer-1", [
      { totalAmount: 10000, trumpPercent: 50, deliveryMethod: "SELF" },
    ]);
    const alreadyOpen: Card[] = [{ ...cards[0], state: CardState.OPEN }];
    const { repo, transitions } = fakeRepo();

    const issued = await markOrderPaidAndOpenCards(repo, order, alreadyOpen, {});
    expect(issued).toHaveLength(0);
    expect(transitions).toHaveLength(0);
  });
});

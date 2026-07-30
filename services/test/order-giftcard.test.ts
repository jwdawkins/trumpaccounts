import { describe, it, expect } from "vitest";
import { placeGiftCardOrder } from "../src/fulfillment/order-giftcard";
import { CardState, GiftCardLeg, TrumpLeg } from "../src/domain/states";
import type { Repo } from "../src/data/repo";
import type { Card } from "../src/domain/types";
import type { GiftCardOrderer, CreateGiftCardOrder } from "../src/giftcards/provider";

function makeCard(over: Partial<Card> = {}): Card {
  return {
    cardId: "card-1", orderId: "order-1", buyerId: "buyer-1",
    totalAmount: 5000, trumpPercent: 50, trumpAmount: 2500, giftCardAmount: 2500,
    allowedGiftCardProducts: [], selectedGiftCardProduct: "P_AMZN",
    recipientName: "Jane Doe", deliveryMethod: "EMAIL", recipientEmail: "jane@example.com",
    state: CardState.CLAIMED, giftCardLeg: GiftCardLeg.ORDERED, trumpLeg: TrumpLeg.VERIFIED,
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function fakeRepo(card: Card | undefined) {
  const saved: Card[] = [];
  const transitions: { to: CardState; patch?: Partial<Card> }[] = [];
  const events: { reason?: string }[] = [];
  const repo = {
    async getCard() { return card; },
    async saveCard(c: Card) { saved.push(c); },
    async appendEvent(e: { reason?: string }) { events.push(e); },
    async transitionCard(p: { to: CardState; patch?: Partial<Card> }) { transitions.push({ to: p.to, patch: p.patch }); },
  } as unknown as Repo;
  return { repo, saved, transitions, events };
}

/** Orderer that records the request and returns/throws as configured. */
function fakeOrderer(
  impl: (o: CreateGiftCardOrder) => Promise<{ orderId: string; rewardId?: string; status: string; link?: string }>,
) {
  const calls: CreateGiftCardOrder[] = [];
  const orderer: GiftCardOrderer = {
    async createOrder(o) { calls.push(o); return impl(o); },
  };
  return { orderer, calls };
}

describe("placeGiftCardOrder (§6.3 async worker)", () => {
  it("EMAIL delivery, trump not yet transferred → DELIVERED, no COMPLETE", async () => {
    const { repo, saved, transitions } = fakeRepo(makeCard());
    const { orderer, calls } = fakeOrderer(async () => ({ orderId: "ORD1", rewardId: "R1", status: "EXECUTED" }));

    const out = await placeGiftCardOrder(repo, orderer, "card-1");

    expect(out).toMatchObject({ status: "delivered", completed: false, tremendousOrderId: "ORD1" });
    expect(calls[0]).toMatchObject({ externalId: "card-1", productId: "P_AMZN", amountCents: 2500, delivery: "EMAIL", recipientEmail: "jane@example.com" });
    expect(saved[0].giftCardLeg).toBe(GiftCardLeg.DELIVERED);
    expect(saved[0].tremendousOrderId).toBe("ORD1");
    expect(transitions).toHaveLength(0);
  });

  it("trump already TRANSFERRED → converges to COMPLETE via transition with the patch", async () => {
    const { repo, transitions, saved } = fakeRepo(makeCard({ trumpLeg: TrumpLeg.TRANSFERRED }));
    const { orderer } = fakeOrderer(async () => ({ orderId: "ORD2", status: "EXECUTED" }));

    const out = await placeGiftCardOrder(repo, orderer, "card-1");

    expect(out).toMatchObject({ status: "delivered", completed: true });
    expect(saved).toHaveLength(0); // completion goes through transitionCard, not saveCard
    expect(transitions[0].to).toBe(CardState.COMPLETE);
    expect(transitions[0].patch?.giftCardLeg).toBe(GiftCardLeg.DELIVERED);
  });

  it("no recipient email → LINK delivery and the returned link is stored", async () => {
    const { repo, saved } = fakeRepo(makeCard({ recipientEmail: undefined, deliveryMethod: "SELF" }));
    const { orderer, calls } = fakeOrderer(async () => ({ orderId: "ORD3", status: "EXECUTED", link: "https://reward/x" }));

    await placeGiftCardOrder(repo, orderer, "card-1");

    expect(calls[0].delivery).toBe("LINK");
    expect(calls[0].recipientEmail).toBeUndefined();
    expect(saved[0].tremendousRewardLink).toBe("https://reward/x");
  });

  it("is idempotent — a DELIVERED card is skipped without ordering", async () => {
    const { repo } = fakeRepo(makeCard({ giftCardLeg: GiftCardLeg.DELIVERED, tremendousOrderId: "OLD" }));
    const { orderer, calls } = fakeOrderer(async () => ({ orderId: "X", status: "EXECUTED" }));
    const out = await placeGiftCardOrder(repo, orderer, "card-1");
    expect(out.status).toBe("skipped");
    expect(calls).toHaveLength(0);
  });

  it("stale leg (SELECTED, not ORDERED) is skipped", async () => {
    const { repo } = fakeRepo(makeCard({ giftCardLeg: GiftCardLeg.SELECTED }));
    const { orderer, calls } = fakeOrderer(async () => ({ orderId: "X", status: "EXECUTED" }));
    const out = await placeGiftCardOrder(repo, orderer, "card-1");
    expect(out.status).toBe("skipped");
    expect(calls).toHaveLength(0);
  });

  it("permanent 4xx from the provider → marks FAILED and does not throw", async () => {
    const { repo, saved } = fakeRepo(makeCard());
    const err = Object.assign(new Error("bad product"), { status: 422 });
    const { orderer } = fakeOrderer(async () => { throw err; });

    const out = await placeGiftCardOrder(repo, orderer, "card-1");
    expect(out.status).toBe("failed_permanent");
    expect(saved[0].giftCardLeg).toBe(GiftCardLeg.FAILED);
  });

  it("transient error (5xx / no status) throws so SQS retries", async () => {
    const { repo } = fakeRepo(makeCard());
    const err = Object.assign(new Error("gateway"), { status: 502 });
    const { orderer } = fakeOrderer(async () => { throw err; });
    await expect(placeGiftCardOrder(repo, orderer, "card-1")).rejects.toThrow("gateway");
  });

  it("unknown card is skipped (no retry storm)", async () => {
    const { repo } = fakeRepo(undefined);
    const { orderer, calls } = fakeOrderer(async () => ({ orderId: "X", status: "EXECUTED" }));
    const out = await placeGiftCardOrder(repo, orderer, "missing");
    expect(out.status).toBe("skipped");
    expect(calls).toHaveLength(0);
  });
});

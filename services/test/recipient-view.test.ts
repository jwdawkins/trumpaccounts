import { describe, it, expect } from "vitest";
import { recipientChecklist, recipientDetails } from "../src/domain/recipient-view";
import { buildOrderFromCart } from "../src/domain/cart";
import { CardState, GiftCardLeg, TrumpLeg } from "../src/domain/states";
import type { Card } from "../src/domain/types";

function card(overrides: Partial<Card>): Card {
  const { cards } = buildOrderFromCart("b", [
    { totalAmount: 10000, trumpPercent: 50, deliveryMethod: "SELF" },
  ]);
  return { ...cards[0], ...overrides };
}

const byKey = (card: Card) => Object.fromEntries(recipientChecklist(card).map((s) => [s.key, s.status]));

describe("recipientChecklist (§4.2)", () => {
  it("shows 4 steps (select + send + verify + fund) when a gift card is involved", () => {
    const steps = recipientChecklist(card({ giftCardLeg: GiftCardLeg.AWAITING_SELECTION }));
    expect(steps.map((s) => s.key)).toEqual(["giftCardSelected", "trumpVerified", "fundsTransferred", "giftCardSent"]);
  });

  it("hides the gift-card steps at 100% split (giftCardLeg NONE)", () => {
    const steps = recipientChecklist(card({ giftCardLeg: GiftCardLeg.NONE }));
    expect(steps.map((s) => s.key)).toEqual(["trumpVerified", "fundsTransferred"]);
  });

  it("all done when both legs finished", () => {
    const s = byKey(card({ giftCardLeg: GiftCardLeg.DELIVERED, trumpLeg: TrumpLeg.TRANSFERRED }));
    expect(s).toEqual({ giftCardSelected: "done", giftCardSent: "done", trumpVerified: "done", fundsTransferred: "done" });
  });

  it("linked (verifying) is active, not stuck — funds still pending", () => {
    const s = byKey(card({ giftCardLeg: GiftCardLeg.SELECTED, trumpLeg: TrumpLeg.LINKED }));
    expect(s.trumpVerified).toBe("active");
    expect(s.fundsTransferred).toBe("pending");
  });

  it("verified: funds step goes active (preparing), gift-card send pending until ordered", () => {
    const s = byKey(card({ giftCardLeg: GiftCardLeg.SELECTED, trumpLeg: TrumpLeg.VERIFIED }));
    expect(s.trumpVerified).toBe("done");
    expect(s.fundsTransferred).toBe("active");
    expect(s.giftCardSent).toBe("pending");
  });

  it("transfer initiated / gift ordered read as active", () => {
    const s = byKey(card({ giftCardLeg: GiftCardLeg.ORDERED, trumpLeg: TrumpLeg.TRANSFER_INITIATED }));
    expect(s.giftCardSent).toBe("active");
    expect(s.fundsTransferred).toBe("active");
  });

  it("mismatch / funding failure surface as attention", () => {
    expect(byKey(card({ trumpLeg: TrumpLeg.MISMATCH })).trumpVerified).toBe("attention");
    expect(byKey(card({ trumpLeg: TrumpLeg.FAILED })).fundsTransferred).toBe("attention");
    expect(byKey(card({ giftCardLeg: GiftCardLeg.FAILED })).giftCardSent).toBe("attention");
  });

  it("details carry a headline + progress flags", () => {
    const done = recipientDetails(card({ giftCardLeg: GiftCardLeg.DELIVERED, trumpLeg: TrumpLeg.TRANSFERRED, state: CardState.COMPLETE }));
    expect(done.complete).toBe(true);
    expect(done.headline).toMatch(/all set/i);

    const working = recipientDetails(card({ giftCardLeg: GiftCardLeg.SELECTED, trumpLeg: TrumpLeg.LINKED, state: CardState.CLAIMED }));
    expect(working.inProgress).toBe(true);
    expect(working.headline).toMatch(/finishing up/i);
  });
});

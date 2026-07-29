import { describe, it, expect } from "vitest";
import { recipientChecklist } from "../src/domain/recipient-view";
import { buildOrderFromCart } from "../src/domain/cart";
import { GiftCardLeg, TrumpLeg } from "../src/domain/states";
import type { Card } from "../src/domain/types";

function card(overrides: Partial<Card>): Card {
  const { cards } = buildOrderFromCart("b", [
    { totalAmount: 10000, trumpPercent: 50, deliveryMethod: "SELF" },
  ]);
  return { ...cards[0], ...overrides };
}

describe("recipientChecklist (§4.2)", () => {
  it("shows 3 steps when a gift card is involved", () => {
    const steps = recipientChecklist(card({ giftCardLeg: GiftCardLeg.AWAITING_SELECTION }));
    expect(steps.map((s) => s.key)).toEqual(["giftCardSelected", "trumpVerified", "fundsTransferred"]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("hides the gift-card step at 100% split (giftCardLeg NONE)", () => {
    const steps = recipientChecklist(card({ giftCardLeg: GiftCardLeg.NONE }));
    expect(steps.map((s) => s.key)).toEqual(["trumpVerified", "fundsTransferred"]);
  });

  it("marks steps done by leg progress", () => {
    const steps = recipientChecklist(
      card({ giftCardLeg: GiftCardLeg.DELIVERED, trumpLeg: TrumpLeg.TRANSFERRED }),
    );
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it("verified-but-not-transferred: step 2 done, step 3 not", () => {
    const steps = recipientChecklist(
      card({ giftCardLeg: GiftCardLeg.SELECTED, trumpLeg: TrumpLeg.VERIFIED }),
    );
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(byKey.giftCardSelected).toBe(true);
    expect(byKey.trumpVerified).toBe(true);
    expect(byKey.fundsTransferred).toBe(false);
  });
});

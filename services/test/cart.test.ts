import { describe, it, expect } from "vitest";
import { buildOrderFromCart, validateCartItem, CartValidationError, CartItemInput } from "../src/domain/cart";
import { CardState, GiftCardLeg, TrumpLeg } from "../src/domain/states";

const base: CartItemInput = {
  totalAmount: 10000,
  trumpPercent: 50,
  deliveryMethod: "EMAIL",
  recipientEmail: "kid@example.com",
  recipientName: "Sam",
};

describe("validateCartItem (D2/D3)", () => {
  it("accepts a well-formed item", () => {
    expect(() => validateCartItem(base)).not.toThrow();
  });
  it("requires email for EMAIL delivery", () => {
    expect(() => validateCartItem({ ...base, recipientEmail: undefined })).toThrow(CartValidationError);
  });
  it("requires phone for SMS delivery", () => {
    expect(() => validateCartItem({ ...base, deliveryMethod: "SMS", recipientEmail: undefined })).toThrow();
  });
  it("allows SELF delivery with no contact info", () => {
    expect(() =>
      validateCartItem({ totalAmount: 2500, trumpPercent: 25, deliveryMethod: "SELF" }),
    ).not.toThrow();
  });
  it("rejects bad percentages and sub-dollar amounts", () => {
    expect(() => validateCartItem({ ...base, trumpPercent: 30 })).toThrow();
    expect(() => validateCartItem({ ...base, totalAmount: 50 })).toThrow();
  });
});

describe("buildOrderFromCart", () => {
  it("computes split, initial legs, and order total", () => {
    const { order, cards } = buildOrderFromCart("buyer-1", [base]);
    expect(cards).toHaveLength(1);
    const c = cards[0];
    expect(c.trumpAmount).toBe(5000);
    expect(c.giftCardAmount).toBe(5000);
    expect(c.state).toBe(CardState.PENDING_PAYMENT);
    expect(c.giftCardLeg).toBe(GiftCardLeg.AWAITING_SELECTION);
    expect(c.trumpLeg).toBe(TrumpLeg.UNLINKED);
    expect(order.totalAmount).toBe(10000);
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.cardIds).toEqual([c.cardId]);
  });

  it("100% Trump split has no gift-card leg (D5)", () => {
    const { cards } = buildOrderFromCart("buyer-1", [
      { totalAmount: 8000, trumpPercent: 100, deliveryMethod: "SELF" },
    ]);
    expect(cards[0].giftCardAmount).toBe(0);
    expect(cards[0].giftCardLeg).toBe(GiftCardLeg.NONE);
    expect(cards[0].allowedGiftCardProducts).toEqual([]);
  });

  it("sums multiple cards into the order total", () => {
    const { order, cards } = buildOrderFromCart("buyer-1", [
      base,
      { totalAmount: 2500, trumpPercent: 25, deliveryMethod: "SELF" },
    ]);
    expect(cards).toHaveLength(2);
    expect(order.totalAmount).toBe(12500);
    expect(order.cardIds).toHaveLength(2);
  });

  it("rejects an empty cart", () => {
    expect(() => buildOrderFromCart("buyer-1", [])).toThrow(CartValidationError);
  });
});

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
  it("a VERIFIED gift requires a recipient name", () => {
    expect(() =>
      validateCartItem({ ...base, verificationMode: "VERIFIED", recipientName: undefined }),
    ).toThrow(/name/i);
  });
  it("an OPEN gift needs no name", () => {
    expect(() =>
      validateCartItem({ totalAmount: 5000, trumpPercent: 50, deliveryMethod: "SELF", verificationMode: "OPEN" }),
    ).not.toThrow();
  });
  it("accepts a custom whole percent", () => {
    expect(() => validateCartItem({ ...base, trumpPercent: 37 })).not.toThrow();
  });
  it("rejects out-of-range / non-integer percentages and sub-dollar amounts", () => {
    expect(() => validateCartItem({ ...base, trumpPercent: 0 })).toThrow();
    expect(() => validateCartItem({ ...base, trumpPercent: 101 })).toThrow();
    expect(() => validateCartItem({ ...base, trumpPercent: 33.5 })).toThrow();
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

describe("verification mode (OPEN vs VERIFIED)", () => {
  it("OPEN gift carries no recipient name even if one is passed", () => {
    const { cards } = buildOrderFromCart("b", [
      { totalAmount: 5000, trumpPercent: 50, deliveryMethod: "SELF", verificationMode: "OPEN", recipientName: "Ignored" },
    ]);
    expect(cards[0].verificationMode).toBe("OPEN");
    expect(cards[0].recipientName).toBeUndefined();
  });
  it("VERIFIED gift keeps the recipient name", () => {
    const { cards } = buildOrderFromCart("b", [
      { totalAmount: 5000, trumpPercent: 50, deliveryMethod: "SELF", verificationMode: "VERIFIED", recipientName: "Sam" },
    ]);
    expect(cards[0].verificationMode).toBe("VERIFIED");
    expect(cards[0].recipientName).toBe("Sam");
  });
  it("defaults to OPEN when no name and no mode given", () => {
    const { cards } = buildOrderFromCart("b", [
      { totalAmount: 5000, trumpPercent: 50, deliveryMethod: "SELF" },
    ]);
    expect(cards[0].verificationMode).toBe("OPEN");
  });
});

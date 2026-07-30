import { describe, it, expect } from "vitest";
import { isFeeBearing, recipientDenominationCents } from "../src/giftcards/fees";
import { classifyProduct } from "../src/giftcards/provider";

describe("gift-card fees (§6.3)", () => {
  it("flags only cash-out categories as fee-bearing", () => {
    expect(isFeeBearing("venmo")).toBe(true);
    expect(isFeeBearing("paypal")).toBe(true);
    expect(isFeeBearing("ach")).toBe(true);
    expect(isFeeBearing("merchant_card")).toBe(false);
    expect(isFeeBearing("visa_card")).toBe(false);
    expect(isFeeBearing(undefined)).toBe(false);
  });

  it("fee-free categories get the full budget as the denomination", () => {
    expect(recipientDenominationCents("merchant_card", 7500)).toBe(7500);
    expect(recipientDenominationCents("visa_card", 10000)).toBe(10000);
    expect(recipientDenominationCents(undefined, 5000)).toBe(5000);
  });

  it("cash-out reduces the recipient payout by the ~4% fee (default rate)", () => {
    // 7500 / 1.04 = 7211.5 -> floor 7211
    expect(recipientDenominationCents("venmo", 7500)).toBe(7211);
    // net + ~4% fee ≈ budget (our cost stays ~7500)
    const net = recipientDenominationCents("paypal", 10000);
    expect(net).toBe(9615); // 10000/1.04 = 9615.3 -> 9615
    expect(net + Math.round(net * 0.04)).toBeLessThanOrEqual(10000 + 1);
  });
});

describe("classifyProduct (recipient grouping)", () => {
  it("maps categories to friendly types with delivery notes", () => {
    expect(classifyProduct("merchant_card", "Amazon")).toMatchObject({ type: "gift_card", feeBearing: false });
    expect(classifyProduct("visa_card", "Virtual Visa")).toMatchObject({ type: "prepaid_visa", physical: false });
    expect(classifyProduct("visa_card", "Physical Visa")).toMatchObject({ type: "prepaid_visa", physical: true });
    expect(classifyProduct("venmo", "Venmo")).toMatchObject({ type: "cash_out", feeBearing: true });
    expect(classifyProduct("charity", "Red Cross")).toMatchObject({ type: "donation", feeBearing: false });
  });
});

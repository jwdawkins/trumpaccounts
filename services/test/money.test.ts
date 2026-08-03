import { describe, it, expect } from "vitest";
import { splitCents, dollarsToCents, formatCents, isTrumpPercent, processingFeeCents } from "../src/domain/money";

describe("splitCents", () => {
  it("splits so the parts always sum back to the total (incl. custom percents)", () => {
    for (const total of [100, 999, 12345, 5000, 1]) {
      for (const pct of [1, 10, 25, 37, 50, 63, 99, 100]) {
        const { trumpCents, giftCardCents } = splitCents(total, pct);
        expect(trumpCents + giftCardCents).toBe(total);
        expect(Number.isInteger(trumpCents)).toBe(true);
        expect(Number.isInteger(giftCardCents)).toBe(true);
      }
    }
  });

  it("puts everything in the Trump leg at 100%", () => {
    expect(splitCents(5000, 100)).toEqual({ trumpCents: 5000, giftCardCents: 0 });
  });

  it("rounds the Trump portion to the nearest cent (10% of 999 = 100)", () => {
    expect(splitCents(999, 10)).toEqual({ trumpCents: 100, giftCardCents: 899 });
  });

  it("rejects zero / negative / non-integer totals", () => {
    expect(() => splitCents(0, 25)).toThrow();
    expect(() => splitCents(-100, 25)).toThrow();
    expect(() => splitCents(10.5, 25)).toThrow();
  });
});

describe("helpers", () => {
  it("dollarsToCents avoids float artefacts", () => {
    expect(dollarsToCents(1.1)).toBe(110);
    expect(dollarsToCents(19.99)).toBe(1999);
  });
  it("formatCents renders currency", () => {
    expect(formatCents(1999)).toBe("$19.99");
    expect(formatCents(0)).toBe("$0.00");
  });
  it("isTrumpPercent accepts any whole percent 1–100", () => {
    expect(isTrumpPercent(25)).toBe(true);
    expect(isTrumpPercent(30)).toBe(true);
    expect(isTrumpPercent(1)).toBe(true);
    expect(isTrumpPercent(100)).toBe(true);
    expect(isTrumpPercent(0)).toBe(false);
    expect(isTrumpPercent(101)).toBe(false);
    expect(isTrumpPercent(-5)).toBe(false);
    expect(isTrumpPercent(33.5)).toBe(false);
  });
});

describe("processingFeeCents (§7.1)", () => {
  it("2.9% of subtotal + $2.50 first gift + $1 each additional", () => {
    // $100 subtotal, 1 gift: 2.9%*100=$2.90 + $2.50 = $5.40
    expect(processingFeeCents(10000, 1)).toBe(540);
    // $100 subtotal, 2 gifts: $2.90 + $2.50 + $1.00 = $6.40
    expect(processingFeeCents(10000, 2)).toBe(640);
    // $100 subtotal, 3 gifts: $2.90 + $2.50 + $2.00 = $7.40
    expect(processingFeeCents(10000, 3)).toBe(740);
  });
  it("rounds the percentage to the nearest cent", () => {
    // 2.9% of $73.33 = 212.657 -> 213 ; + 250 = 463
    expect(processingFeeCents(7333, 1)).toBe(213 + 250);
  });
  it("is zero for an empty cart", () => {
    expect(processingFeeCents(0, 0)).toBe(0);
  });
});

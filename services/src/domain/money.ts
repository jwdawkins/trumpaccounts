/**
 * Money handling. Everything is integer CENTS — no floats anywhere (handoff §5).
 */

/** Trump Account allocation percentages offered on the storefront (§7.1). */
export type TrumpPercent = 10 | 25 | 50 | 100;
export const TRUMP_PERCENTS: readonly TrumpPercent[] = [10, 25, 50, 100];

export function isTrumpPercent(n: number): n is TrumpPercent {
  return (TRUMP_PERCENTS as readonly number[]).includes(n);
}

/** Guard: a value must be a non-negative safe integer number of cents. */
export function assertCents(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer of cents, got ${value}`);
  }
}

export interface Split {
  readonly trumpCents: number;
  readonly giftCardCents: number;
}

/**
 * Split a total between the Trump Account contribution and the gift-card leg.
 *
 * The Trump portion is rounded to the nearest cent; the gift-card portion is
 * the remainder, so the two ALWAYS sum back to the exact total (no lost cents).
 * At 100% the gift-card leg is zero (becomes `NONE` — see states.ts / D5).
 */
export function splitCents(totalCents: number, pct: TrumpPercent): Split {
  assertCents(totalCents, "totalCents");
  if (totalCents === 0) {
    throw new Error("totalCents must be greater than zero");
  }
  const trumpCents = Math.round((totalCents * pct) / 100);
  const giftCardCents = totalCents - trumpCents;
  return { trumpCents, giftCardCents };
}

/**
 * Buyer processing fee (§7.1), charged on top of the gift subtotal:
 *   2.9% of the whole order subtotal + $2.50 for the first gift + $1.00 each
 *   additional gift. Rounded to the nearest cent. Returns 0 for an empty cart.
 */
export const PROCESSING_FEE = {
  rate: 0.029,
  firstGiftCents: 250,
  additionalGiftCents: 100,
} as const;

export function processingFeeCents(subtotalCents: number, giftCount: number): number {
  assertCents(subtotalCents, "subtotalCents");
  if (giftCount <= 0) return 0;
  const pct = Math.round(subtotalCents * PROCESSING_FEE.rate);
  const fixed = PROCESSING_FEE.firstGiftCents + PROCESSING_FEE.additionalGiftCents * (giftCount - 1);
  return pct + fixed;
}

export function dollarsToCents(dollars: number): number {
  // Route through rounding to avoid float artefacts (e.g. 1.1 * 100 = 110.000001).
  return Math.round(dollars * 100);
}

export function formatCents(cents: number): string {
  assertCents(cents);
  return `$${(cents / 100).toFixed(2)}`;
}

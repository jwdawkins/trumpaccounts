/**
 * Tremendous fee handling (§6.3). Gift cards + prepaid Visa are fee-free; cash-out
 * payouts carry a fee that the SENDER pays on top of the denomination. Per the
 * product decision, the recipient's payout is REDUCED by the fee so the platform's
 * cost stays at the budgeted gift amount. Measured sandbox rate ≈ 4%; overridable.
 */
export const FEE_BEARING_CATEGORIES: ReadonlySet<string> = new Set([
  "paypal",
  "venmo",
  "cash_app",
  "ach",
  "instant_debit_transfer",
]);

export function isFeeBearing(category: string | undefined): boolean {
  return !!category && FEE_BEARING_CATEGORIES.has(category);
}

function payoutFeeRate(): number {
  const r = Number(process.env.TREMENDOUS_PAYOUT_FEE_RATE);
  return Number.isFinite(r) && r >= 0 && r < 1 ? r : 0.04;
}

/**
 * The reward denomination (integer cents) to request so that
 * denomination + fee ≈ budget. Fee-free categories get the full budget; fee-
 * bearing categories are reduced by the estimated fee (floored to whole cents).
 * The ACTUAL fee is read back from the order response and stored — this only
 * decides the denomination up front (the API exposes fees only at order time).
 */
export function recipientDenominationCents(category: string | undefined, budgetCents: number): number {
  if (!isFeeBearing(category)) return budgetCents;
  const net = Math.floor(budgetCents / (1 + payoutFeeRate()));
  return Math.max(net, 1);
}

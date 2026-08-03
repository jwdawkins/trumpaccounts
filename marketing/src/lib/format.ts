/** UI money helpers — integer cents in, display strings out. */
export const centsToDollars = (cents: number): string => (cents / 100).toFixed(2);
export const formatCents = (cents: number): string => `$${centsToDollars(cents)}`;
export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);

/**
 * Buyer processing fee (§7.1) — mirrors the server (domain/money.ts): 2.9% of the
 * order subtotal + $2.50 for the first gift + $1.00 each additional gift. Display
 * only; the server recomputes authoritatively at order creation.
 */
export function processingFeeCents(subtotalCents: number, giftCount: number): number {
  if (giftCount <= 0) return 0;
  return Math.round(subtotalCents * 0.029) + 250 + 100 * (giftCount - 1);
}

/** UI money helpers — integer cents in, display strings out. */
export const centsToDollars = (cents: number): string => (cents / 100).toFixed(2);
export const formatCents = (cents: number): string => `$${centsToDollars(cents)}`;
export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);

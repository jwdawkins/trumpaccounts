import { formatCents } from "../domain/money";

/**
 * Shared gift math + copy for the recipient-facing deliverables (PDF + email),
 * so both stay in sync with the storefront configurator. The configurator lets a
 * gifter tweak the child's age and assumed return, but those aren't persisted, so
 * the deliverables use the same DEFAULTS the configurator ships with: a newborn
 * (18 years to age 18, then 47 more to 65) and an 8% average annual return.
 */
const ANNUAL_RETURN = 0.08;
const YEARS_TO_18 = 18;
const YEARS_18_TO_65 = 47;

export interface GiftSummary {
  amountCents: number;
  trumpPercent: number;
  investedCents: number;
  spendableCents: number;
  projectedAt18Cents: number;
  projectedAt65Cents: number;
  trueGiftValueCents: number;
}

export function computeGiftSummary(amountCents: number, trumpPercent: number): GiftSummary {
  const pct = Number.isFinite(trumpPercent) ? Math.max(0, Math.min(100, trumpPercent)) : 0;
  const investedCents = Math.round((amountCents * pct) / 100);
  const spendableCents = amountCents - investedCents;
  const growth = 1 + ANNUAL_RETURN;
  const projectedAt18Cents = Math.round(investedCents * Math.pow(growth, YEARS_TO_18));
  const projectedAt65Cents = Math.round(projectedAt18Cents * Math.pow(growth, YEARS_18_TO_65));
  return {
    amountCents,
    trumpPercent: pct,
    investedCents,
    spendableCents,
    projectedAt18Cents,
    projectedAt65Cents,
    trueGiftValueCents: spendableCents + projectedAt18Cents,
  };
}

/** Whole-dollar format for the big projections, e.g. "$12,345". */
export function formatDollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export { formatCents };

export const RETURN_LABEL = "8% avg. annual return";
export const PROJECTION_DISCLAIMER =
  "Projections assume a newborn and an 8% average annual return, based on historical U.S. stock market performance. Illustration only — actual results will vary.";

export const TRUMP_ACCOUNT_FACTS = [
  "A new tax-advantaged investment account for children under 18",
  "Created by the One Big Beautiful Bill Act, signed July 4, 2025",
  "Families can contribute up to $5,000 per year",
  "Invested in U.S. stock market index funds (S&P 500)",
  "At 18, it transfers to the child to use for their future goals",
];

/** Brand palette shared with the site/card. */
export const BRAND = {
  navy: "#060D18",
  navyLift: "#0A1B33",
  gold: "#C79E4D",
  white: "#FFFFFF",
  paper: "#02060D",
};

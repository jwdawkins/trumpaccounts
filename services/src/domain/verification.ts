/**
 * Name-match verification (handoff D3).
 *
 * Rule: if the buyer provided a recipient name, it must match the linked Trump
 * Account holder's name (mismatch -> UNVERIFIED). If the buyer left the name
 * blank, the check is skipped and verification passes on any linked account,
 * unless REQUIRE_NAME_MATCH_WHEN_ABSENT is set.
 */

import { VerificationMode } from "./types";

export type NameMatchOutcome = "MATCH" | "MISMATCH" | "SKIPPED";

/**
 * Is this an OPEN gift (no name check — post to any linked account)? Uses the
 * explicit mode when set; for legacy cards without a mode, infers OPEN when no
 * recipient name was provided (the old implicit behavior).
 */
export function isOpenGift(mode: VerificationMode | undefined, recipientName?: string): boolean {
  if (mode) return mode === "OPEN";
  return !recipientName || !recipientName.trim();
}

/** Normalize a name to lowercase alnum tokens for tolerant comparison. */
export function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** True if the smaller token set is fully contained in the larger (e.g. "Riley" ⊂ "Riley Dawkins"). */
function tokenSubset(a: string[], b: string[]): boolean {
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (small.length === 0) return false;
  const bigSet = new Set(big);
  return small.every((t) => bigSet.has(t));
}

export function matchNames(
  buyerName: string | undefined,
  accountHolderName: string | undefined,
  opts: { requireWhenAbsent?: boolean } = {},
): NameMatchOutcome {
  const requireWhenAbsent = opts.requireWhenAbsent ?? false;

  if (!buyerName || !buyerName.trim()) {
    // No buyer-provided name (D3): skip unless config forces a manual review.
    return requireWhenAbsent ? "MISMATCH" : "SKIPPED";
  }
  if (!accountHolderName || !accountHolderName.trim()) {
    return "MISMATCH"; // buyer named a recipient but the account shows none
  }
  return tokenSubset(nameTokens(buyerName), nameTokens(accountHolderName)) ? "MATCH" : "MISMATCH";
}

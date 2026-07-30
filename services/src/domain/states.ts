/**
 * Canonical state machine (handoff §4).
 *
 * One machine governs every card; personas get display mappings (§4, §7).
 * The transition table is the single source of truth — `assertTransition`
 * THROWS on any transition not listed here (tested exhaustively per §10).
 */

export enum CardState {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  OPEN = "OPEN",
  CLAIMED = "CLAIMED",
  AWAITING_TRUMP_ACCOUNT = "AWAITING_TRUMP_ACCOUNT",
  UNVERIFIED = "UNVERIFIED",
  COMPLETE = "COMPLETE",
  VOIDED = "VOIDED",
  EXPIRED = "EXPIRED",
  REFUNDED = "REFUNDED",
}

/** Terminal states have no outgoing transitions. */
export const TERMINAL_STATES: ReadonlySet<CardState> = new Set([
  CardState.COMPLETE,
  CardState.VOIDED,
  CardState.EXPIRED,
  CardState.REFUNDED,
]);

export function isTerminal(state: CardState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Allowed transitions. Derived from §4.1 plus the admin powers in §7.3/D11:
 *   - Admin may VOID or REFUND from any non-terminal state.
 *   - EXPIRED is reachable from OPEN/AWAITING via the scheduler (feature-flagged, O7).
 *   - AWAITING_TRUMP_ACCOUNT -> CLAIMED is the "back to CLAIMED path" once linked.
 *   - UNVERIFIED -> OPEN is the disallow path (prior claim invalidated, D3/§4.1).
 */
const TRANSITIONS: Readonly<Record<CardState, ReadonlySet<CardState>>> = {
  [CardState.PENDING_PAYMENT]: new Set([
    CardState.OPEN,
    CardState.VOIDED,
    CardState.REFUNDED,
  ]),
  [CardState.OPEN]: new Set([
    CardState.CLAIMED,
    CardState.AWAITING_TRUMP_ACCOUNT,
    CardState.VOIDED,
    CardState.EXPIRED,
    CardState.REFUNDED,
  ]),
  [CardState.CLAIMED]: new Set([
    CardState.COMPLETE,
    CardState.UNVERIFIED,
    CardState.VOIDED,
    CardState.REFUNDED,
  ]),
  [CardState.AWAITING_TRUMP_ACCOUNT]: new Set([
    CardState.CLAIMED,
    CardState.VOIDED,
    CardState.EXPIRED,
    CardState.REFUNDED,
  ]),
  [CardState.UNVERIFIED]: new Set([
    CardState.COMPLETE,
    CardState.OPEN,
    CardState.VOIDED,
    CardState.REFUNDED,
  ]),
  [CardState.COMPLETE]: new Set(),
  [CardState.VOIDED]: new Set(),
  [CardState.EXPIRED]: new Set(),
  [CardState.REFUNDED]: new Set(),
};

export function canTransition(from: CardState, to: CardState): boolean {
  return TRANSITIONS[from].has(to);
}

/** Throws `InvalidTransitionError` if `from -> to` is not allowed. */
export function assertTransition(from: CardState, to: CardState): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: CardState,
    public readonly to: CardState,
  ) {
    super(`Invalid card state transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/* ------------------------------------------------------------------ *
 * Fulfillment legs (§4.2) — attributes on the card, drive recipient UI.
 * ------------------------------------------------------------------ */

export enum GiftCardLeg {
  NONE = "NONE", // 100% Trump split — no gift card at all (D5)
  AWAITING_SELECTION = "AWAITING_SELECTION",
  SELECTED = "SELECTED",
  ORDERED = "ORDERED",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
}

export enum TrumpLeg {
  UNLINKED = "UNLINKED",
  LINKED = "LINKED",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  VERIFIED = "VERIFIED",
  MISMATCH = "MISMATCH",
  TRANSFER_INITIATED = "TRANSFER_INITIATED",
  TRANSFERRED = "TRANSFERRED",
  FAILED = "FAILED",
}

/**
 * COMPLETE ⇔ giftCardLeg ∈ {NONE, DELIVERED} AND trumpLeg = TRANSFERRED (§4.2).
 * Use this to decide when a card may transition into COMPLETE.
 */
export function legsSatisfyComplete(giftCardLeg: GiftCardLeg, trumpLeg: TrumpLeg): boolean {
  const giftDone = giftCardLeg === GiftCardLeg.NONE || giftCardLeg === GiftCardLeg.DELIVERED;
  return giftDone && trumpLeg === TrumpLeg.TRANSFERRED;
}

/* ------------------------------------------------------------------ *
 * Buyer-facing display mapping (§4 / §7.1). Recipient UI uses the legs.
 * ------------------------------------------------------------------ */

export type BuyerStatus =
  | "Open"
  | "Awaiting Trump Account"
  | "Trump Account Pending"
  | "Transferring"
  | "Needs attention"
  | "Complete"
  | "Voided"
  | "Expired"
  | "Refunded"
  | "Processing";

/**
 * Buyer-facing status (§4/§7.1). Reflects the Trump-Account funding progress so
 * the gifter sees a meaningful state, not a generic "Pending". Derived from the
 * card state plus the trump leg (which drives the CLAIMED sub-states).
 */
export function buyerStatus(state: CardState, trumpLeg: TrumpLeg = TrumpLeg.UNLINKED): BuyerStatus {
  switch (state) {
    case CardState.PENDING_PAYMENT:
      return "Processing"; // not normally shown to the buyer
    case CardState.OPEN:
      return "Open";
    case CardState.AWAITING_TRUMP_ACCOUNT:
      return "Awaiting Trump Account"; // opened, but recipient has no account yet
    case CardState.CLAIMED:
      if (trumpLeg === TrumpLeg.MISMATCH || trumpLeg === TrumpLeg.FAILED) return "Needs attention";
      if (trumpLeg === TrumpLeg.TRANSFER_INITIATED || trumpLeg === TrumpLeg.TRANSFERRED) return "Transferring";
      return "Trump Account Pending"; // linked/verifying, contribution not yet made
    case CardState.UNVERIFIED:
      return "Needs attention";
    case CardState.COMPLETE:
      return "Complete";
    case CardState.VOIDED:
      return "Voided";
    case CardState.EXPIRED:
      return "Expired";
    case CardState.REFUNDED:
      return "Refunded";
  }
}

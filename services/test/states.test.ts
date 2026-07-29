import { describe, it, expect } from "vitest";
import {
  CardState,
  GiftCardLeg,
  TrumpLeg,
  canTransition,
  assertTransition,
  InvalidTransitionError,
  isTerminal,
  legsSatisfyComplete,
  buyerStatus,
} from "../src/domain/states";

// Independent copy of the expected transition table (§4.1 + §7.3/D11).
// If states.ts drifts from the design, this test fails.
const EXPECTED: Record<CardState, CardState[]> = {
  [CardState.PENDING_PAYMENT]: [CardState.OPEN, CardState.VOIDED, CardState.REFUNDED],
  [CardState.OPEN]: [
    CardState.CLAIMED,
    CardState.AWAITING_TRUMP_ACCOUNT,
    CardState.VOIDED,
    CardState.EXPIRED,
    CardState.REFUNDED,
  ],
  [CardState.CLAIMED]: [
    CardState.COMPLETE,
    CardState.UNVERIFIED,
    CardState.VOIDED,
    CardState.REFUNDED,
  ],
  [CardState.AWAITING_TRUMP_ACCOUNT]: [
    CardState.CLAIMED,
    CardState.VOIDED,
    CardState.EXPIRED,
    CardState.REFUNDED,
  ],
  [CardState.UNVERIFIED]: [
    CardState.COMPLETE,
    CardState.OPEN,
    CardState.VOIDED,
    CardState.REFUNDED,
  ],
  [CardState.COMPLETE]: [],
  [CardState.VOIDED]: [],
  [CardState.EXPIRED]: [],
  [CardState.REFUNDED]: [],
};

const ALL = Object.values(CardState);

describe("state machine — exhaustive transition table (§4, §10)", () => {
  it("allows exactly the designed transitions and throws on every other", () => {
    for (const from of ALL) {
      const allowed = new Set(EXPECTED[from]);
      for (const to of ALL) {
        if (allowed.has(to)) {
          expect(canTransition(from, to), `${from}->${to} should be allowed`).toBe(true);
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(canTransition(from, to), `${from}->${to} should be blocked`).toBe(false);
          expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
        }
      }
    }
  });

  it("terminal states have no outgoing transitions", () => {
    for (const s of [CardState.COMPLETE, CardState.VOIDED, CardState.EXPIRED, CardState.REFUNDED]) {
      expect(isTerminal(s)).toBe(true);
      expect(EXPECTED[s]).toHaveLength(0);
    }
  });

  it("disallow path returns UNVERIFIED to OPEN (D3)", () => {
    expect(canTransition(CardState.UNVERIFIED, CardState.OPEN)).toBe(true);
  });

  it("no self-transitions", () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false);
  });
});

describe("fulfillment legs (§4.2)", () => {
  it("COMPLETE iff giftCardLeg in {NONE,DELIVERED} and trumpLeg=TRANSFERRED", () => {
    expect(legsSatisfyComplete(GiftCardLeg.NONE, TrumpLeg.TRANSFERRED)).toBe(true);
    expect(legsSatisfyComplete(GiftCardLeg.DELIVERED, TrumpLeg.TRANSFERRED)).toBe(true);
    expect(legsSatisfyComplete(GiftCardLeg.SELECTED, TrumpLeg.TRANSFERRED)).toBe(false);
    expect(legsSatisfyComplete(GiftCardLeg.DELIVERED, TrumpLeg.VERIFIED)).toBe(false);
  });
});

describe("buyer status mapping (§4/§7.1)", () => {
  it("maps CLAIMED and AWAITING_TRUMP_ACCOUNT both to Pending (D6)", () => {
    expect(buyerStatus(CardState.CLAIMED)).toBe("Pending");
    expect(buyerStatus(CardState.AWAITING_TRUMP_ACCOUNT)).toBe("Pending");
  });
  it("maps terminal + open states directly", () => {
    expect(buyerStatus(CardState.OPEN)).toBe("Open");
    expect(buyerStatus(CardState.COMPLETE)).toBe("Complete");
    expect(buyerStatus(CardState.UNVERIFIED)).toBe("Unverified");
    expect(buyerStatus(CardState.REFUNDED)).toBe("Refunded");
  });
});

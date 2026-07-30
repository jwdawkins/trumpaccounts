import { describe, it, expect } from "vitest";
import { runTrumpFunding, scheduleFundingRetry } from "../src/funding/run-funding";
import { CardState, GiftCardLeg, TrumpLeg } from "../src/domain/states";
import { TrumpFundingError } from "../src/funding/provider";
import type { TrumpAccountFundingProvider } from "../src/funding/provider";
import type { Repo } from "../src/data/repo";
import type { Card } from "../src/domain/types";

function makeCard(over: Partial<Card> = {}): Card {
  return {
    cardId: "card-1", orderId: "order-1", buyerId: "buyer-1",
    totalAmount: 5000, trumpPercent: 50, trumpAmount: 2500, giftCardAmount: 2500,
    allowedGiftCardProducts: [],
    recipientName: "Riley Dawkins", deliveryMethod: "SELF",
    state: CardState.CLAIMED, giftCardLeg: GiftCardLeg.DELIVERED, trumpLeg: TrumpLeg.LINKED,
    linkedTrumpAccountRef: "https://contribute.trumpaccount.com/riley-123/?secret=x",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function fakeRepo(card: Card | undefined) {
  const saved: Card[] = [];
  const transitions: { to: CardState; patch?: Partial<Card> }[] = [];
  const events: { reason?: string }[] = [];
  const repo = {
    async getCard() { return saved.length ? saved[saved.length - 1] : card; },
    async saveCard(c: Card) { saved.push(c); },
    async appendEvent(e: { reason?: string }) { events.push(e); },
    async transitionCard(p: { to: CardState; patch?: Partial<Card> }) { transitions.push({ to: p.to, patch: p.patch }); },
  } as unknown as Repo;
  return { repo, saved, transitions, events };
}

function provider(over: Partial<TrumpAccountFundingProvider> = {}): TrumpAccountFundingProvider {
  return {
    async getAccountHolderName({ recipientName }) { return recipientName; }, // echo => MATCH
    async contribute({ cardId }) { return { confirmationRef: `REF-${cardId}` }; },
    ...over,
  };
}

describe("runTrumpFunding (async auto-verify + contribute)", () => {
  it("LINKED, name matches, gift already delivered → VERIFIED then TRANSFERRED → COMPLETE", async () => {
    const { repo, saved, transitions } = fakeRepo(makeCard());
    const out = await runTrumpFunding(repo, provider(), "card-1");

    expect(out).toMatchObject({ status: "transferred", completed: true, ref: "REF-card-1" });
    // saw VERIFIED then TRANSFER_INITIATED saves before completion
    expect(saved.map((c) => c.trumpLeg)).toEqual([TrumpLeg.VERIFIED, TrumpLeg.TRANSFER_INITIATED]);
    expect(transitions[0].to).toBe(CardState.COMPLETE);
    expect(transitions[0].patch?.trumpLeg).toBe(TrumpLeg.TRANSFERRED);
    expect(transitions[0].patch?.trumpTransferRef).toBe("REF-card-1");
  });

  it("gift leg not done → TRANSFERRED but stays CLAIMED (no COMPLETE)", async () => {
    const { repo, saved, transitions } = fakeRepo(makeCard({ giftCardLeg: GiftCardLeg.SELECTED }));
    const out = await runTrumpFunding(repo, provider(), "card-1");
    expect(out).toMatchObject({ status: "transferred", completed: false });
    expect(transitions).toHaveLength(0);
    expect(saved[saved.length - 1].trumpLeg).toBe(TrumpLeg.TRANSFERRED);
  });

  it("name mismatch → UNVERIFIED + trumpLeg MISMATCH, no contribution", async () => {
    const { repo, transitions } = fakeRepo(makeCard({ recipientName: "Someone Else" }));
    let contributed = false;
    const p = provider({
      async getAccountHolderName() { return "Riley Dawkins"; },
      async contribute() { contributed = true; return { confirmationRef: "X" }; },
    });
    const out = await runTrumpFunding(repo, p, "card-1");
    expect(out.status).toBe("mismatch");
    expect(contributed).toBe(false);
    expect(transitions[0].to).toBe(CardState.UNVERIFIED);
    expect(transitions[0].patch?.trumpLeg).toBe(TrumpLeg.MISMATCH);
  });

  it("OPEN gift: verifies without any name check and contributes", async () => {
    const { repo, saved } = fakeRepo(makeCard({ verificationMode: "OPEN", recipientName: undefined }));
    let nameChecked = false;
    const p = provider({
      async getAccountHolderName() { nameChecked = true; return "Someone Totally Different"; },
    });
    const out = await runTrumpFunding(repo, p, "card-1");
    expect(nameChecked).toBe(false); // OPEN never reads/matches the account name
    expect(out.status).toBe("transferred");
    expect(saved.map((c) => c.trumpLeg)).toContain(TrumpLeg.VERIFIED);
  });

  it("VERIFIED gift with a mismatching account → UNVERIFIED", async () => {
    const { repo, transitions } = fakeRepo(makeCard({ verificationMode: "VERIFIED", recipientName: "Riley Dawkins" }));
    const p = provider({ async getAccountHolderName() { return "Someone Else"; } });
    const out = await runTrumpFunding(repo, p, "card-1");
    expect(out.status).toBe("mismatch");
    expect(transitions[0].to).toBe(CardState.UNVERIFIED);
  });

  it("already TRANSFERRED → skipped (idempotent)", async () => {
    const { repo } = fakeRepo(makeCard({ trumpLeg: TrumpLeg.TRANSFERRED }));
    const out = await runTrumpFunding(repo, provider(), "card-1");
    expect(out.status).toBe("skipped");
  });

  it("retryable contribute error propagates (for the worker to retry)", async () => {
    const { repo } = fakeRepo(makeCard());
    const p = provider({ async contribute() { throw new TrumpFundingError("outage", true); } });
    await expect(runTrumpFunding(repo, p, "card-1")).rejects.toBeInstanceOf(TrumpFundingError);
  });

  it("non-retryable contribute error → trumpLeg FAILED, no throw", async () => {
    const { repo, saved } = fakeRepo(makeCard());
    const p = provider({ async contribute() { throw new TrumpFundingError("bad account", false); } });
    const out = await runTrumpFunding(repo, p, "card-1");
    expect(out.status).toBe("failed_permanent");
    expect(saved[saved.length - 1].trumpLeg).toBe(TrumpLeg.FAILED);
  });

  it("resumes from VERIFIED without re-verifying", async () => {
    let verifyCalls = 0;
    const { repo, saved } = fakeRepo(makeCard({ trumpLeg: TrumpLeg.VERIFIED }));
    const p = provider({ async getAccountHolderName({ recipientName }) { verifyCalls++; return recipientName; } });
    const out = await runTrumpFunding(repo, p, "card-1");
    expect(verifyCalls).toBe(0);
    expect(out.status).toBe("transferred");
  });
});

describe("scheduleFundingRetry (long/scheduled retries)", () => {
  it("stamps a future retryAt and bumps attempts", async () => {
    const { repo, saved } = fakeRepo(makeCard({ trumpLeg: TrumpLeg.TRANSFER_INITIATED }));
    const res = await scheduleFundingRetry(repo, "card-1", 3_600_000, 24);
    expect(res).toBe("scheduled");
    expect(saved[0].trumpFundingAttempts).toBe(1);
    expect(saved[0].trumpFundingRetryAt).toBeTruthy();
  });

  it("gives up (FAILED) once past longMax", async () => {
    const { repo, saved } = fakeRepo(makeCard({ trumpLeg: TrumpLeg.TRANSFER_INITIATED, trumpFundingAttempts: 24 }));
    const res = await scheduleFundingRetry(repo, "card-1", 3_600_000, 24);
    expect(res).toBe("failed");
    expect(saved[0].trumpLeg).toBe(TrumpLeg.FAILED);
  });

  it("no-ops if already transferred", async () => {
    const { repo } = fakeRepo(makeCard({ trumpLeg: TrumpLeg.TRANSFERRED }));
    expect(await scheduleFundingRetry(repo, "card-1", 1000, 24)).toBe("gone");
  });
});

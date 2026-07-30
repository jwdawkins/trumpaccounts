import { Repo } from "../data/repo";
import { Card } from "../domain/types";
import { CardState, TrumpLeg, legsSatisfyComplete, isTerminal } from "../domain/states";
import { matchNames, isOpenGift } from "../domain/verification";
import { newEventId } from "../domain/tokens";
import { TrumpAccountFundingProvider, TrumpFundingError } from "./provider";

const ACTOR = "system:trump-funding-worker";

export type FundingOutcome =
  | { status: "transferred"; completed: boolean; ref: string }
  | { status: "mismatch"; reason: string } // needs admin (allow/disallow)
  | { status: "skipped"; reason: string }
  | { status: "failed_permanent"; reason: string };

/** trump legs from which the async worker may (re)start funding. */
const RESUMABLE = new Set<TrumpLeg>([
  TrumpLeg.LINKED,
  TrumpLeg.PENDING_VERIFICATION,
  TrumpLeg.VERIFIED,
  TrumpLeg.TRANSFER_INITIATED,
]);

/**
 * Async Trump-Account funding (auto-verify + contribute). Triggered when the
 * recipient links their account; runs server-side only (never in the browser).
 * Automates the ManualOps verify + transfer:
 *   1. name-match (D3) the account-holder name -> VERIFIED, or MISMATCH->UNVERIFIED
 *      (which stops here and waits for the admin allow/disallow flow);
 *   2. contribute to the debit-card step and settle -> TRANSFERRED, converging to
 *      COMPLETE when the gift-card leg is done.
 * Idempotent (already-TRANSFERRED is skipped; the provider dedups on cardId).
 * Retryable failures throw so the caller can reschedule.
 */
export async function runTrumpFunding(
  repo: Repo,
  provider: TrumpAccountFundingProvider,
  cardId: string,
): Promise<FundingOutcome> {
  const card = await repo.getCard(cardId);
  if (!card) return { status: "skipped", reason: "card not found" };
  if (card.trumpLeg === TrumpLeg.TRANSFERRED) return { status: "skipped", reason: "already transferred" };
  if (isTerminal(card.state)) return { status: "skipped", reason: `terminal state ${card.state}` };
  if (!RESUMABLE.has(card.trumpLeg)) return { status: "skipped", reason: `trumpLeg ${card.trumpLeg} not resumable` };
  if (!card.linkedTrumpAccountRef) return { status: "skipped", reason: "no linked account ref" };

  const linkedRef: string = card.linkedTrumpAccountRef;
  let current = card;

  // Step 1 — auto-verify (skip if already past verification).
  if (current.trumpLeg === TrumpLeg.LINKED || current.trumpLeg === TrumpLeg.PENDING_VERIFICATION) {
    if (isOpenGift(current.verificationMode, current.recipientName)) {
      // OPEN gift — no name check; the contribution posts to whatever account
      // was linked.
      const now = new Date().toISOString();
      current = { ...current, trumpLeg: TrumpLeg.VERIFIED, updatedAt: now };
      await repo.saveCard(current);
      await repo.appendEvent(mkEvent(current, undefined, now, "auto-verified (OPEN — no name check)"));
    } else {
      // VERIFIED gift — the account-holder name must match the recipient.
      const accountName = await provider.getAccountHolderName({
        linkedRef,
        recipientName: current.recipientName,
        amountCents: current.trumpAmount,
        fromName: current.fromName,
      });
      const outcome = matchNames(current.recipientName, accountName, { requireWhenAbsent: true });

      if (outcome === "MISMATCH") {
        const now = new Date().toISOString();
        await repo.transitionCard({
          card: current, to: CardState.UNVERIFIED, actor: ACTOR,
          reason: `name mismatch: recipient="${current.recipientName ?? ""}" account="${accountName ?? ""}"`,
          patch: { trumpLeg: TrumpLeg.MISMATCH, verifiedAccountHolderName: accountName },
          event: mkEvent(current, CardState.UNVERIFIED, now, "auto name mismatch — needs admin review"),
        });
        return { status: "mismatch", reason: "name mismatch" };
      }

      const now = new Date().toISOString();
      current = { ...current, trumpLeg: TrumpLeg.VERIFIED, verifiedAccountHolderName: accountName, updatedAt: now };
      await repo.saveCard(current);
      await repo.appendEvent(mkEvent(current, undefined, now, `auto-verified (${outcome})`));
    }
  }

  // Step 2 — mark the contribution in-flight (once), then contribute.
  if (current.trumpLeg !== TrumpLeg.TRANSFER_INITIATED) {
    const now = new Date().toISOString();
    current = { ...current, trumpLeg: TrumpLeg.TRANSFER_INITIATED, updatedAt: now };
    await repo.saveCard(current);
    await repo.appendEvent(mkEvent(current, undefined, now, "contribution initiated"));
  }

  let result;
  try {
    result = await provider.contribute({
      linkedRef,
      amountCents: current.trumpAmount,
      cardId: current.cardId,
      fromName: current.fromName,
      message: current.message,
    });
  } catch (e) {
    if (e instanceof TrumpFundingError && !e.retryable) {
      await markFailed(repo, current, e.message);
      return { status: "failed_permanent", reason: e.message };
    }
    throw e; // retryable — caller reschedules
  }

  // Success — settle the leg, clearing any retry bookkeeping.
  const now = new Date().toISOString();
  const patch: Partial<Card> = {
    trumpLeg: TrumpLeg.TRANSFERRED,
    trumpTransferRef: result.confirmationRef,
    trumpFundingAttempts: undefined,
    trumpFundingRetryAt: undefined,
  };
  const completes = legsSatisfyComplete(current.giftCardLeg, TrumpLeg.TRANSFERRED) && !isTerminal(current.state);
  const reason = `contribution settled (ref ${result.confirmationRef})`;

  if (completes) {
    await repo.transitionCard({
      card: current, to: CardState.COMPLETE, actor: ACTOR,
      reason: `${reason}; both legs complete`, patch,
      event: mkEvent(current, CardState.COMPLETE, now, reason),
    });
  } else {
    await repo.saveCard({ ...current, ...patch, updatedAt: now });
    await repo.appendEvent(mkEvent(current, undefined, now, reason));
  }

  return { status: "transferred", completed: completes, ref: result.confirmationRef };
}

/**
 * Record a scheduled (long) retry after the quick SQS retries are exhausted.
 * Bumps the attempt counter and stamps `trumpFundingRetryAt` for the sweeper to
 * re-enqueue; gives up (trumpLeg FAILED) once `longMax` scheduled retries pass.
 */
export async function scheduleFundingRetry(
  repo: Repo,
  cardId: string,
  delayMs: number,
  longMax: number,
): Promise<"scheduled" | "failed" | "gone"> {
  const card = await repo.getCard(cardId);
  if (!card || card.trumpLeg === TrumpLeg.TRANSFERRED || isTerminal(card.state)) return "gone";

  const attempts = (card.trumpFundingAttempts ?? 0) + 1;
  const now = new Date();
  if (attempts > longMax) {
    await repo.saveCard({ ...card, trumpLeg: TrumpLeg.FAILED, trumpFundingRetryAt: undefined, updatedAt: now.toISOString() });
    await repo.appendEvent(mkEvent(card, undefined, now.toISOString(), `funding gave up after ${attempts - 1} scheduled retries`));
    return "failed";
  }
  const retryAt = new Date(now.getTime() + delayMs).toISOString();
  await repo.saveCard({ ...card, trumpFundingAttempts: attempts, trumpFundingRetryAt: retryAt, updatedAt: now.toISOString() });
  await repo.appendEvent(mkEvent(card, undefined, now.toISOString(), `funding retry #${attempts} scheduled for ${retryAt}`));
  return "scheduled";
}

async function markFailed(repo: Repo, card: Card, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await repo.saveCard({ ...card, trumpLeg: TrumpLeg.FAILED, updatedAt: now });
  await repo.appendEvent(mkEvent(card, undefined, now, `funding FAILED: ${reason}`));
}

function mkEvent(card: Card, to: CardState | undefined, timestamp: string, reason: string) {
  return {
    eventId: newEventId(),
    cardId: card.cardId,
    orderId: card.orderId,
    actor: ACTOR,
    from: to ? card.state : undefined,
    to,
    leg: "trump" as const,
    reason,
    timestamp,
  };
}

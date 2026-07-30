import { Card } from "./types";
import { CardState, GiftCardLeg, TrumpLeg } from "./states";

// Progress ordering for the trump leg sub-states (§4.2).
const TRUMP_ORDER: TrumpLeg[] = [
  TrumpLeg.UNLINKED,
  TrumpLeg.LINKED,
  TrumpLeg.PENDING_VERIFICATION,
  TrumpLeg.VERIFIED,
  TrumpLeg.TRANSFER_INITIATED,
  TrumpLeg.TRANSFERRED,
];

const trumpAtLeast = (leg: TrumpLeg, min: TrumpLeg) =>
  TRUMP_ORDER.indexOf(leg) >= 0 && TRUMP_ORDER.indexOf(leg) >= TRUMP_ORDER.indexOf(min);

/** Per-step status so an in-flight step reads as "working", not "stuck". */
export type StepStatus = "done" | "active" | "pending" | "attention";

export interface ChecklistStep {
  key: "giftCardSelected" | "giftCardSent" | "trumpVerified" | "fundsTransferred";
  label: string;
  status: StepStatus;
  /** Short activity/explanation shown under the step. */
  detail?: string;
  /** Redemption link surfaced on the "gift card sent" step once delivered. */
  rewardLink?: string;
}

function giftCardSelectedStep(leg: GiftCardLeg): ChecklistStep {
  const selected = leg !== GiftCardLeg.AWAITING_SELECTION; // SELECTED/ORDERED/DELIVERED/FAILED
  return {
    key: "giftCardSelected",
    label: "Gift card selected",
    status: selected ? "done" : "active",
    detail: selected ? undefined : "Choose your gift card above",
  };
}

function giftCardSentStep(card: Card): ChecklistStep {
  const base = { key: "giftCardSent" as const, label: "Gift card sent" };
  switch (card.giftCardLeg) {
    case GiftCardLeg.DELIVERED:
      return {
        ...base,
        status: "done",
        detail: card.recipientEmail ? "Also emailed to you — or redeem here" : "Redeem your gift here",
        rewardLink: card.tremendousRewardLink,
      };
    case GiftCardLeg.ORDERED:
      return { ...base, status: "active", detail: "Sending your gift card…" };
    case GiftCardLeg.FAILED:
      return { ...base, status: "attention", detail: "We hit a snag — retrying your gift card" };
    default:
      return { ...base, status: "pending" };
  }
}

function trumpVerifiedStep(leg: TrumpLeg): ChecklistStep {
  const base = { key: "trumpVerified" as const, label: "Trump Account verified" };
  if (trumpAtLeast(leg, TrumpLeg.VERIFIED)) return { ...base, status: "done" };
  if (leg === TrumpLeg.LINKED || leg === TrumpLeg.PENDING_VERIFICATION)
    return { ...base, status: "active", detail: "Verifying your Trump Account…" };
  if (leg === TrumpLeg.MISMATCH)
    return { ...base, status: "attention", detail: "We're reviewing your account details" };
  return { ...base, status: "pending" };
}

function fundsTransferredStep(leg: TrumpLeg): ChecklistStep {
  const base = { key: "fundsTransferred" as const, label: "Contribution added to Trump Account" };
  switch (leg) {
    case TrumpLeg.TRANSFERRED:
      return { ...base, status: "done" };
    case TrumpLeg.TRANSFER_INITIATED:
      return { ...base, status: "active", detail: "Adding your contribution…" };
    case TrumpLeg.VERIFIED:
      return { ...base, status: "active", detail: "Preparing your contribution…" };
    case TrumpLeg.FAILED:
      return { ...base, status: "attention", detail: "Contribution didn't go through — we'll retry shortly" };
    default:
      return { ...base, status: "pending" };
  }
}

/**
 * Recipient status checklist (§4.2 / 1.2.6). Each step carries a status so the
 * recipient sees live progress (verifying / sending) rather than a static list
 * of unchecked boxes that looks stuck.
 *   ① Gift card selected  ② Gift card sent   (both hidden when giftCardLeg NONE)
 *   ③ Trump Account verified                 ④ Contribution added
 */
export function recipientChecklist(card: Card): ChecklistStep[] {
  const hasGift = card.giftCardLeg !== GiftCardLeg.NONE;
  const steps: ChecklistStep[] = [];
  // Gift-card *selection* is the recipient's action, so it stays near the top;
  // the actual gift-card *send* lands after the Trump contribution (§ ordering).
  if (hasGift) steps.push(giftCardSelectedStep(card.giftCardLeg));
  steps.push(trumpVerifiedStep(card.trumpLeg));
  steps.push(fundsTransferredStep(card.trumpLeg));
  if (hasGift) steps.push(giftCardSentStep(card));
  return steps;
}

/** Headline summarizing overall progress for the recipient. */
export function recipientHeadline(card: Card, steps: ChecklistStep[]): string {
  if (card.state === CardState.COMPLETE) return "🎉 Your gift is all set!";
  if (steps.some((s) => s.status === "attention")) return "We're sorting something out";
  // Anything not yet done (active OR pending) means the gift is still processing —
  // never say "all set" while a step remains.
  if (steps.some((s) => s.status !== "done")) return "We're finishing up your gift…";
  return "Almost done…"; // all legs done but not yet flipped to COMPLETE
}

/** Recipient-facing gift details (no buyer PII beyond the sender's first name). */
export function recipientDetails(card: Card) {
  const checklist = recipientChecklist(card);
  return {
    cardId: card.cardId,
    amount: card.totalAmount,
    trumpAmount: card.trumpAmount,
    giftCardAmount: card.giftCardAmount,
    trumpPercent: card.trumpPercent,
    fromName: card.fromName,
    recipientName: card.recipientName,
    message: card.message,
    needsGiftCardSelection: card.giftCardLeg === GiftCardLeg.AWAITING_SELECTION,
    allowedGiftCardProducts: card.allowedGiftCardProducts,
    selectedGiftCardProduct: card.selectedGiftCardProduct,
    state: card.state,
    complete: card.state === CardState.COMPLETE,
    // Still working while any step is not done — drives the client auto-refresh.
    inProgress: checklist.some((s) => s.status !== "done"),
    headline: recipientHeadline(card, checklist),
    checklist,
  };
}

import { Card } from "./types";
import { GiftCardLeg, TrumpLeg } from "./states";

// Progress ordering for the leg sub-states (§4.2).
const GIFT_ORDER: GiftCardLeg[] = [
  GiftCardLeg.AWAITING_SELECTION,
  GiftCardLeg.SELECTED,
  GiftCardLeg.ORDERED,
  GiftCardLeg.DELIVERED,
];
const TRUMP_ORDER: TrumpLeg[] = [
  TrumpLeg.UNLINKED,
  TrumpLeg.LINKED,
  TrumpLeg.PENDING_VERIFICATION,
  TrumpLeg.VERIFIED,
  TrumpLeg.TRANSFER_INITIATED,
  TrumpLeg.TRANSFERRED,
];

const giftAtLeast = (leg: GiftCardLeg, min: GiftCardLeg) =>
  GIFT_ORDER.indexOf(leg) >= GIFT_ORDER.indexOf(min);
const trumpAtLeast = (leg: TrumpLeg, min: TrumpLeg) =>
  TRUMP_ORDER.indexOf(leg) >= TRUMP_ORDER.indexOf(min);

export interface ChecklistStep {
  key: "giftCardSelected" | "trumpVerified" | "fundsTransferred";
  label: string;
  done: boolean;
}

/**
 * Recipient status checklist (§4.2 / 1.2.6):
 *   ① Gift card selected  (hidden entirely when giftCardLeg === NONE)
 *   ② Trump Account verified
 *   ③ Funds transferred
 */
export function recipientChecklist(card: Card): ChecklistStep[] {
  const steps: ChecklistStep[] = [];
  if (card.giftCardLeg !== GiftCardLeg.NONE) {
    steps.push({
      key: "giftCardSelected",
      label: "Gift card selected",
      done: giftAtLeast(card.giftCardLeg, GiftCardLeg.SELECTED),
    });
  }
  steps.push({
    key: "trumpVerified",
    label: "Trump Account verified",
    done: trumpAtLeast(card.trumpLeg, TrumpLeg.VERIFIED),
  });
  steps.push({
    key: "fundsTransferred",
    label: "Funds transferred",
    done: card.trumpLeg === TrumpLeg.TRANSFERRED,
  });
  return steps;
}

/** Recipient-facing gift details (no buyer PII beyond the sender's first name). */
export function recipientDetails(card: Card) {
  return {
    cardId: card.cardId,
    amount: card.totalAmount,
    trumpAmount: card.trumpAmount,
    giftCardAmount: card.giftCardAmount,
    trumpPercent: card.trumpPercent,
    fromName: card.fromName,
    recipientName: card.recipientName,
    message: card.message,
    needsGiftCardSelection:
      card.giftCardLeg === GiftCardLeg.AWAITING_SELECTION,
    allowedGiftCardProducts: card.allowedGiftCardProducts,
    selectedGiftCardProduct: card.selectedGiftCardProduct,
    state: card.state,
    checklist: recipientChecklist(card),
  };
}

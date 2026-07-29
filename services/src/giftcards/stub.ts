import { GiftCardProvider, GiftCardProduct } from "./provider";

/**
 * Stub catalog used until the Tremendous account/API is wired (§6.3).
 * Popular products (Starbucks, Amazon, Prepaid Visa) are pinned first, matching
 * the placeholder ids used by the storefront.
 */
const CATALOG: GiftCardProduct[] = [
  { id: "TREM_STARBUCKS", name: "Starbucks", popular: true },
  { id: "TREM_AMAZON", name: "Amazon", popular: true },
  { id: "TREM_PREPAID_VISA", name: "Prepaid Visa", popular: true },
  { id: "TREM_TARGET", name: "Target", popular: false },
  { id: "TREM_WALMART", name: "Walmart", popular: false },
  { id: "TREM_DOORDASH", name: "DoorDash", popular: false },
];

export class StubGiftCardProvider implements GiftCardProvider {
  async listCatalog(): Promise<GiftCardProduct[]> {
    return [...CATALOG].sort((a, b) => Number(b.popular) - Number(a.popular));
  }
}

/** Shared default instance. */
export const giftCards: GiftCardProvider = new StubGiftCardProvider();

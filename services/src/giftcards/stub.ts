import {
  GiftCardProvider,
  GiftCardProduct,
  CreateGiftCardOrder,
  GiftCardOrderResult,
  classifyProduct,
} from "./provider";

/**
 * Stub catalog + ordering used for local dev and tests when no Tremendous secret
 * is configured (§6.3). Popular products are pinned first; createOrder simulates
 * a placed reward so the state machine can be exercised end-to-end offline.
 */
const RAW: { id: string; name: string; popular: boolean; category: string }[] = [
  { id: "TREM_VIRTUAL_VISA", name: "Visa Gift Card", popular: true, category: "visa_card" },
  { id: "TREM_AMAZON", name: "Amazon", popular: true, category: "merchant_card" },
  { id: "TREM_STARBUCKS", name: "Starbucks", popular: true, category: "merchant_card" },
  { id: "TREM_WALMART", name: "Walmart", popular: true, category: "merchant_card" },
  { id: "TREM_TARGET", name: "Target", popular: false, category: "merchant_card" },
  { id: "TREM_VENMO", name: "Venmo", popular: false, category: "venmo" },
  { id: "TREM_CHARITY", name: "Red Cross", popular: false, category: "charity" },
];
const CATALOG: GiftCardProduct[] = RAW.map((p) => ({
  id: p.id,
  name: p.name,
  popular: p.popular,
  category: p.category,
  ...classifyProduct(p.category, p.name),
  minCents: 100,
  maxCents: 200000,
}));

export class StubGiftCardProvider implements GiftCardProvider {
  async listCatalog(): Promise<GiftCardProduct[]> {
    return [...CATALOG].sort((a, b) => Number(b.popular) - Number(a.popular));
  }

  async createOrder(order: CreateGiftCardOrder): Promise<GiftCardOrderResult> {
    return {
      orderId: `SIM-${order.externalId.slice(0, 8)}`,
      rewardId: `SIM-RWD-${order.externalId.slice(0, 8)}`,
      status: "EXECUTED",
      link: `https://example.test/reward/${order.externalId}`,
      recipientCents: order.amountCents,
      feeCents: 0,
      totalCents: order.amountCents,
    };
  }
}

/** Shared default instance (used by giftcards/index.ts when no secret is set). */
export const giftCards: GiftCardProvider = new StubGiftCardProvider();

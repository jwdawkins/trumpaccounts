import {
  GiftCardProvider,
  GiftCardProduct,
  CreateGiftCardOrder,
  GiftCardOrderResult,
} from "./provider";

/**
 * Stub catalog + ordering used for local dev and tests when no Tremendous secret
 * is configured (§6.3). Popular products are pinned first; createOrder simulates
 * a placed reward so the state machine can be exercised end-to-end offline.
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

  async createOrder(order: CreateGiftCardOrder): Promise<GiftCardOrderResult> {
    return {
      orderId: `SIM-${order.externalId.slice(0, 8)}`,
      rewardId: `SIM-RWD-${order.externalId.slice(0, 8)}`,
      status: "EXECUTED",
      link: order.delivery === "LINK" ? `https://example.test/reward/${order.externalId}` : undefined,
    };
  }
}

/** Shared default instance (used by giftcards/index.ts when no secret is set). */
export const giftCards: GiftCardProvider = new StubGiftCardProvider();

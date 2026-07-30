/**
 * Gift-card catalog + ordering abstraction (handoff §6.3). Business logic depends
 * on this interface; the Tremendous-backed provider swaps in without other changes.
 */
/** Friendly grouping shown to the recipient. */
export type GiftCardType = "gift_card" | "prepaid_visa" | "cash_out" | "donation";

export interface GiftCardProduct {
  id: string; // Tremendous product id (opaque code)
  name: string;
  popular: boolean;
  /** Tremendous category, e.g. "merchant_card" | "visa_card" | "venmo". */
  category?: string;
  /** Friendly group + display label for the recipient picker. */
  type: GiftCardType;
  groupLabel: string;
  /** Physical (mailed) product — needs a shipping address at redemption. */
  physical: boolean;
  /** Short delivery expectation, e.g. "Instant — redeem online". */
  deliveryNote: string;
  /** True for cash-out payouts, which carry a fee (recipient payout is reduced). */
  feeBearing: boolean;
  /** Allowed denomination range in integer cents, when the product exposes it. */
  minCents?: number;
  maxCents?: number;
  /** Brand image, when available. */
  imageUrl?: string;
}

const GROUP_LABEL: Record<GiftCardType, string> = {
  gift_card: "Gift cards",
  prepaid_visa: "Prepaid Visa",
  cash_out: "Cash out",
  donation: "Donate",
};

const CASH_OUT_NOTE: Record<string, string> = {
  paypal: "Sent to your PayPal — arrives in minutes",
  venmo: "Sent to your Venmo — arrives in minutes",
  cash_app: "Sent to your Cash App — 1–2 business days",
  ach: "Sent to your bank — 2–4 business days",
  instant_debit_transfer: "Instant to your debit card",
};

/** Classify a Tremendous product into a recipient-facing group + delivery note. */
export function classifyProduct(
  category: string | undefined,
  name: string,
): Pick<GiftCardProduct, "type" | "groupLabel" | "physical" | "deliveryNote" | "feeBearing"> {
  const cat = category ?? "";
  if (cat in CASH_OUT_NOTE) {
    return { type: "cash_out", groupLabel: GROUP_LABEL.cash_out, physical: false, deliveryNote: CASH_OUT_NOTE[cat], feeBearing: true };
  }
  if (cat === "visa_card") {
    const physical = /physical/i.test(name);
    return {
      type: "prepaid_visa", groupLabel: GROUP_LABEL.prepaid_visa, physical,
      deliveryNote: physical ? "Mailed to you (~7 days)" : "Instant virtual card — spend anywhere",
      feeBearing: false,
    };
  }
  if (cat === "charity") {
    return { type: "donation", groupLabel: GROUP_LABEL.donation, physical: false, deliveryNote: "Donate to this cause", feeBearing: false };
  }
  return { type: "gift_card", groupLabel: GROUP_LABEL.gift_card, physical: false, deliveryNote: "Instant — redeem online", feeBearing: false };
}

/** How the reward reaches the recipient. EMAIL = Tremendous emails them; LINK = we surface the URL ourselves. */
export type GiftCardDelivery = "EMAIL" | "LINK";

export interface CreateGiftCardOrder {
  /** Idempotency key for the order (we use the cardId). */
  externalId: string;
  productId: string;
  amountCents: number;
  recipientName: string;
  /** Required for EMAIL delivery; optional for LINK. */
  recipientEmail?: string;
  delivery: GiftCardDelivery;
}

export interface GiftCardOrderResult {
  orderId: string;
  rewardId?: string;
  /** Tremendous order status (e.g. EXECUTED, CART). */
  status: string;
  /** Redemption link the recipient uses to redeem/enter payout details. */
  link?: string;
  /** From the order's payment breakdown (integer cents). */
  recipientCents?: number; // subtotal (what the recipient receives)
  feeCents?: number; // fee the platform paid
  totalCents?: number; // subtotal + fee (what we funded)
}

/**
 * Read-only catalog access. Used by the synchronous, web-facing paths
 * (storefront + recipient claim). These paths NEVER move money, so they are
 * wired to a read-only Tremendous key (§6.3 key separation).
 */
export interface GiftCardCatalog {
  /** Full catalog, popular products first. Cached in real impls. */
  listCatalog(): Promise<GiftCardProduct[]>;
}

/**
 * Money-moving order placement. Used ONLY by the async order-worker, which holds
 * a separate order key. No web-facing function may depend on this interface.
 */
export interface GiftCardOrderer {
  /** Place a reward order for a single selected product. */
  createOrder(order: CreateGiftCardOrder): Promise<GiftCardOrderResult>;
}

/** Convenience for the stub / local dev, which implements both sides. */
export interface GiftCardProvider extends GiftCardCatalog, GiftCardOrderer {}

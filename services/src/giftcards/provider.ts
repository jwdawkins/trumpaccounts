/**
 * Gift-card catalog + ordering abstraction (handoff §6.3). Business logic depends
 * on this interface; the Tremendous-backed provider swaps in without other changes.
 */
export interface GiftCardProduct {
  id: string; // Tremendous product id (opaque code)
  name: string;
  popular: boolean;
  /** Tremendous category, e.g. "merchant_card" | "visa" (optional/best-effort). */
  category?: string;
  /** Allowed denomination range in integer cents, when the product exposes it. */
  minCents?: number;
  maxCents?: number;
  /** Brand image, when available. */
  imageUrl?: string;
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
  /** Redemption link — populated for LINK delivery. */
  link?: string;
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

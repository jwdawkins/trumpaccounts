/**
 * Gift-card catalog abstraction (handoff §6.3). Business logic depends on this
 * interface; a Tremendous-backed provider swaps in later without other changes.
 */
export interface GiftCardProduct {
  id: string; // Tremendous product id (placeholder in the stub)
  name: string;
  popular: boolean;
}

export interface GiftCardProvider {
  /** Full catalog, popular products first. Cached 24h in real impls. */
  listCatalog(): Promise<GiftCardProduct[]>;
}

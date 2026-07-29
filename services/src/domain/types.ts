import { CardState, GiftCardLeg, TrumpLeg } from "./states";
import { TrumpPercent } from "./money";

/** How the claim link reaches the recipient (D2). */
export type DeliveryMethod = "EMAIL" | "SMS" | "SELF";

/** Order-level status mirrors payment lifecycle, not per-card fulfillment. */
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "REFUNDED" | "CANCELLED";

export interface Order {
  readonly orderId: string;
  readonly buyerId: string;
  readonly stripePaymentIntentId?: string;
  readonly stripeCheckoutSessionId?: string;
  /** Sum of all card totals, integer cents. */
  readonly totalAmount: number;
  readonly status: OrderStatus;
  /** Ids of the cards in this order. */
  readonly cardIds: string[];
  readonly createdAt: string; // ISO-8601
  readonly updatedAt: string;
}

export interface Card {
  readonly cardId: string;
  readonly orderId: string;
  readonly buyerId: string;

  // Money (all integer cents).
  readonly totalAmount: number;
  readonly trumpPercent: TrumpPercent;
  readonly trumpAmount: number;
  readonly giftCardAmount: number;

  // Gift-card selection (empty allowed list = recipient's choice).
  readonly allowedGiftCardProducts: string[]; // Tremendous product IDs
  readonly selectedGiftCardProduct?: string;

  // Recipient + delivery (D2/D3).
  readonly recipientName?: string;
  readonly message?: string;
  readonly deliveryMethod: DeliveryMethod;
  readonly recipientEmail?: string;
  readonly recipientPhone?: string;

  // State machine (§4).
  readonly state: CardState;
  readonly giftCardLeg: GiftCardLeg;
  readonly trumpLeg: TrumpLeg;

  // Claim security (§8) — only the hash is ever stored.
  readonly claimTokenHash?: string;
  readonly claimedAt?: string;

  // Fulfillment references.
  readonly linkedTrumpAccountRef?: string;
  readonly mismatchDecision?: "ALLOW" | "DISALLOW";
  readonly tremendousOrderId?: string;
  readonly trumpTransferRef?: string;

  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Immutable audit event (§4.2) — mirrored to the table and streamed to S3. */
export interface CardEvent {
  readonly eventId: string;
  readonly cardId: string;
  readonly orderId: string;
  readonly actor: string; // buyer id, "recipient", "admin:<id>", "system", "stripe"
  readonly from?: CardState;
  readonly to?: CardState;
  readonly leg?: "giftCard" | "trump";
  readonly reason?: string;
  readonly timestamp: string;
  readonly requestId?: string;
}

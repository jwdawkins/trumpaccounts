/**
 * Payment abstraction (handoff §6.2). Business logic depends on this interface,
 * never on Stripe directly — so the transport can be swapped/mocked.
 */

export interface CheckoutLineItem {
  readonly name: string;
  readonly amountCents: number;
  readonly quantity: number;
}

export interface CreateCheckoutParams {
  readonly orderId: string;
  readonly lineItems: CheckoutLineItem[];
  readonly successUrl: string;
  readonly cancelUrl: string;
  /** Client idempotency key so a retried checkout doesn't double-charge (§8). */
  readonly idempotencyKey: string;
  readonly customerEmail?: string;
}

export interface CheckoutResult {
  readonly sessionId: string;
  readonly url: string;
}

/**
 * Normalized payment event — the provider maps raw webhook payloads into this
 * closed set so the downstream processor carries no Stripe dependency.
 */
export type PaymentEvent =
  | { kind: "CHECKOUT_COMPLETED"; eventId: string; orderId: string; paymentIntentId?: string; sessionId: string }
  | { kind: "REFUNDED"; eventId: string; orderId?: string; paymentIntentId?: string }
  | { kind: "IGNORED"; eventId: string; rawType: string };

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface PaymentProvider {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  /** Verify the signature and return a normalized event. Throws WebhookSignatureError. */
  parseWebhook(rawBody: string, signatureHeader: string): PaymentEvent;
}

import Stripe from "stripe";
import {
  PaymentProvider,
  CreateCheckoutParams,
  CheckoutResult,
  PaymentEvent,
  WebhookSignatureError,
} from "./provider";

/**
 * Stripe-backed PaymentProvider (handoff §6.2). Uses hosted Checkout Sessions
 * (one session per order, N cards as line items). Webhooks are signature-verified
 * and mapped to the normalized PaymentEvent set.
 */
export class StripeProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  constructor(
    secretKey: string,
    private readonly webhookSigningSecret: string,
  ) {
    // Omit apiVersion — use the version pinned by the installed SDK.
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(p: CreateCheckoutParams): Promise<CheckoutResult> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: p.lineItems.map((li) => ({
          quantity: li.quantity,
          price_data: {
            currency: "usd",
            unit_amount: li.amountCents,
            product_data: { name: li.name },
          },
        })),
        metadata: { orderId: p.orderId },
        payment_intent_data: { metadata: { orderId: p.orderId } },
        customer_email: p.customerEmail,
        success_url: p.successUrl,
        cancel_url: p.cancelUrl,
      },
      { idempotencyKey: p.idempotencyKey },
    );
    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }
    return { sessionId: session.id, url: session.url };
  }

  parseWebhook(rawBody: string, signatureHeader: string): PaymentEvent {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this.webhookSigningSecret,
      );
    } catch (e) {
      throw new WebhookSignatureError(
        `Stripe signature verification failed: ${(e as Error).message}`,
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.orderId;
        if (!orderId) return { kind: "IGNORED", eventId: event.id, rawType: event.type };
        return {
          kind: "CHECKOUT_COMPLETED",
          eventId: event.id,
          orderId,
          sessionId: s.id,
          paymentIntentId:
            typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
        };
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        return {
          kind: "REFUNDED",
          eventId: event.id,
          orderId: c.metadata?.orderId,
          paymentIntentId:
            typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id,
        };
      }
      default:
        return { kind: "IGNORED", eventId: event.id, rawType: event.type };
    }
  }
}

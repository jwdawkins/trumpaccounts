import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { StripeProvider } from "../payments/stripe";
import { getStripeSecret } from "../config/secrets";
import { formatCents } from "../domain/money";
import { json, buyerIdFromEvent } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const SECRET_ARN = requireEnv("STRIPE_SECRET_ARN");
const WEB_BASE_URL = requireEnv("WEB_BASE_URL");

/**
 * POST /checkout { orderId } — create a Stripe Checkout Session for an order
 * the caller owns (handoff §6.2). Returns the hosted-checkout URL to redirect to.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  let orderId: string;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    orderId = body.orderId;
    if (!orderId) return json(400, { message: "orderId is required" });
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  const found = await repo.getOrderWithCards(orderId);
  if (!found || found.order.buyerId !== buyerId) {
    return json(404, { message: "order not found" });
  }
  if (found.order.status !== "PENDING_PAYMENT") {
    return json(409, { message: `order is not payable (status ${found.order.status})` });
  }

  const secret = await getStripeSecret(SECRET_ARN);
  const provider = new StripeProvider(secret.secretKey, secret.webhookSigningSecret);

  const idempotencyKey =
    (event.headers?.["idempotency-key"] as string | undefined) ?? `checkout-${orderId}`;

  const giftLineItems = found.cards.map((c) => ({
    name: `Gift${c.recipientName ? ` for ${c.recipientName}` : ""} (${formatCents(c.totalAmount)})`,
    amountCents: c.totalAmount,
    quantity: 1,
  }));
  // Processing fee as its own line item, charged on top (§7.1).
  const feeCents = found.order.processingFeeCents ?? 0;
  const lineItems =
    feeCents > 0
      ? [...giftLineItems, { name: "Processing fee", amountCents: feeCents, quantity: 1 }]
      : giftLineItems;

  const { url, sessionId } = await provider.createCheckoutSession({
    orderId,
    lineItems,
    successUrl: `${WEB_BASE_URL}/?checkout=success&order=${orderId}`,
    cancelUrl: `${WEB_BASE_URL}/?checkout=cancel&order=${orderId}`,
    idempotencyKey,
  });

  await repo.saveOrder({ ...found.order, stripeCheckoutSessionId: sessionId });
  return json(200, { url, sessionId });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

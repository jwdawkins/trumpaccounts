import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { buildOrderFromCart, CartValidationError, CartItemInput } from "../domain/cart";
import { json, buyerIdFromEvent } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));

/**
 * POST /orders — create an order + its cards in PENDING_PAYMENT (§7.1, §5).
 * Returns the orderId used to open a Stripe Checkout Session (#11).
 * Auth: Cognito JWT (the buyer's account, created/entered at checkout, D1).
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const buyerId = buyerIdFromEvent(claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  let items: CartItemInput[];
  let acknowledged: boolean;
  let ackVersion: string | undefined;
  let typedFromName: string | undefined;
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    items = body.items;
    acknowledged = body.acknowledged === true;
    ackVersion = typeof body.ackVersion === "string" ? body.ackVersion : undefined;
    typedFromName = typeof body.fromName === "string" ? body.fromName.trim() : undefined;
    if (!Array.isArray(items)) return json(400, { message: "body.items[] is required" });
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  // Resolve the gifter display name: typed name -> login name claim (e.g. Google)
  // -> email (worst case). `name` is populated once federated login is added.
  const claimName = typeof claims?.name === "string" ? (claims.name as string) : undefined;
  const claimEmail = typeof claims?.email === "string" ? (claims.email as string) : undefined;
  const fromName = typedFromName || claimName || claimEmail || buyerId;

  // Irrevocable-contribution acknowledgment is mandatory (§9/O5).
  if (!acknowledged) {
    return json(400, {
      message: "You must acknowledge the irrevocable contribution to continue",
    });
  }

  try {
    const { order, cards } = buildOrderFromCart(buyerId, items, {
      fromName,
      acknowledgedAt: new Date().toISOString(),
      ackVersion: ackVersion ?? "v1",
    });
    await repo.putOrderWithCards(order, cards);
    return json(201, {
      orderId: order.orderId,
      totalAmount: order.totalAmount,
      processingFeeCents: order.processingFeeCents,
      grandTotal: order.totalAmount + order.processingFeeCents,
      cardIds: order.cardIds,
      status: order.status,
    });
  } catch (e) {
    if (e instanceof CartValidationError) return json(400, { message: e.message });
    console.error("create-order failed", e);
    return json(500, { message: "internal error" });
  }
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

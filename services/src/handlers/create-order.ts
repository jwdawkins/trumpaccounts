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
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  let items: CartItemInput[];
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    items = body.items;
    if (!Array.isArray(items)) return json(400, { message: "body.items[] is required" });
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  try {
    const { order, cards } = buildOrderFromCart(buyerId, items);
    await repo.putOrderWithCards(order, cards);
    return json(201, {
      orderId: order.orderId,
      totalAmount: order.totalAmount,
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

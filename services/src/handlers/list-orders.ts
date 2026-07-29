import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { buyerStatus } from "../domain/states";
import { json, buyerIdFromEvent } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));

/**
 * GET /orders — buyer history (§7.1, read-only). Groups the buyer's cards under
 * their orders and maps each card to its buyer-facing status (§4).
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  const { orders, cards } = await repo.listBuyerHistory(buyerId);
  const cardsByOrder = new Map<string, typeof cards>();
  for (const c of cards) {
    const list = cardsByOrder.get(c.orderId) ?? [];
    list.push(c);
    cardsByOrder.set(c.orderId, list);
  }

  const result = orders.map((o) => ({
    orderId: o.orderId,
    totalAmount: o.totalAmount,
    status: o.status,
    createdAt: o.createdAt,
    cards: (cardsByOrder.get(o.orderId) ?? []).map((c) => ({
      cardId: c.cardId,
      totalAmount: c.totalAmount,
      trumpPercent: c.trumpPercent,
      trumpAmount: c.trumpAmount,
      giftCardAmount: c.giftCardAmount,
      recipientName: c.recipientName,
      deliveryMethod: c.deliveryMethod,
      status: buyerStatus(c.state),
    })),
  }));

  return json(200, { orders: result });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

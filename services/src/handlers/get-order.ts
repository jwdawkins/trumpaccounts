import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { buyerStatus, CardState } from "../domain/states";
import { buyerIdFromEvent, json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));

/**
 * GET /orders/{orderId} — a single order the caller owns, with the per-card
 * detail the post-payment confirmation screen needs (brand, delivery, send date,
 * status, claim state, certificate availability). Buyer-authed + ownership-checked.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  const orderId = event.pathParameters?.orderId;
  if (!orderId) return json(400, { message: "orderId required" });

  const found = await repo.getOrderWithCards(orderId);
  if (!found || found.order.buyerId !== buyerId) return json(404, { message: "not found" });
  const { order, cards } = found;

  return json(200, {
    orderId: order.orderId,
    status: order.status,
    totalAmount: order.totalAmount,
    processingFeeCents: order.processingFeeCents,
    createdAt: order.createdAt,
    cards: cards.map((c) => ({
      cardId: c.cardId,
      totalAmount: c.totalAmount,
      trumpPercent: c.trumpPercent,
      trumpAmount: c.trumpAmount,
      giftCardAmount: c.giftCardAmount,
      brandName: c.brandName,
      verificationMode: c.verificationMode,
      recipientName: c.recipientName,
      recipientEmail: c.recipientEmail,
      recipientPhone: c.recipientPhone,
      deliveryMethod: c.deliveryMethod,
      sendDate: c.sendDate,
      status: buyerStatus(c.state, c.trumpLeg),
      state: c.state,
      claimedAt: c.claimedAt,
      // A certificate PDF is generated for every card once the order is paid.
      hasCertificate: c.state !== CardState.PENDING_PAYMENT,
    })),
  });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { CardState, GiftCardLeg, TrumpLeg, legsSatisfyComplete, isTerminal } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { json } from "./http";
import { requireAdmin } from "./admin-helpers";

const repo = new Repo(requireEnv("TABLE_NAME"));
const ORDER_BEFORE_VERIFY = process.env.ORDER_GIFTCARD_BEFORE_VERIFY === "true";

/**
 * POST /admin/cards/{cardId}/fulfill-giftcard — place + deliver the gift card
 * (simulated Tremendous order for MVP). Gated: not ordered until the Trump leg
 * is VERIFIED (§6.3) unless ORDER_GIFTCARD_BEFORE_VERIFY. Converges to COMPLETE
 * if the Trump leg is already transferred.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const admin = requireAdmin(event.requestContext.authorizer?.jwt?.claims);
  if (!admin) return json(403, { message: "admin only" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.giftCardLeg === GiftCardLeg.NONE) {
    return json(409, { message: "this gift has no gift-card portion" });
  }
  if (card.giftCardLeg !== GiftCardLeg.SELECTED) {
    return json(409, { message: `gift card not ready to fulfill (giftCardLeg ${card.giftCardLeg})` });
  }
  if (!ORDER_BEFORE_VERIFY && card.trumpLeg !== TrumpLeg.VERIFIED && card.trumpLeg !== TrumpLeg.TRANSFERRED) {
    return json(409, { message: "Trump leg must be VERIFIED before ordering the gift card (§6.3)" });
  }

  const now = new Date().toISOString();
  const actor = `admin:${admin.adminId}`;
  const tremendousOrderId = `SIM-${cardId.slice(0, 8)}`; // simulated Tremendous order

  const patch = { giftCardLeg: GiftCardLeg.DELIVERED, tremendousOrderId };
  const completes = legsSatisfyComplete(GiftCardLeg.DELIVERED, card.trumpLeg) && !isTerminal(card.state);

  if (completes) {
    await repo.transitionCard({
      card, to: CardState.COMPLETE, actor, reason: "gift card delivered; both legs complete",
      patch,
      event: mkEvent(cardId, card.orderId, actor, card.state, CardState.COMPLETE, "giftCard", now),
    });
    return json(200, { giftCardLeg: GiftCardLeg.DELIVERED, state: CardState.COMPLETE });
  }

  await repo.saveCard({ ...card, ...patch, updatedAt: now });
  await repo.appendEvent(mkEvent(cardId, card.orderId, actor, undefined, undefined, "giftCard", now, "gift card ordered + delivered (simulated)"));
  return json(200, { giftCardLeg: GiftCardLeg.DELIVERED, state: card.state });
};

function mkEvent(
  cardId: string, orderId: string, actor: string,
  from: CardState | undefined, to: CardState | undefined,
  leg: "giftCard" | "trump", timestamp: string, reason = "",
) {
  return { eventId: newEventId(), cardId, orderId, actor, from, to, leg, reason, timestamp };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

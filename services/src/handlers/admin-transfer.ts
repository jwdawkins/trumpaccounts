import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { CardState, TrumpLeg, legsSatisfyComplete, isTerminal } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { json } from "./http";
import { requireAdmin } from "./admin-helpers";

const repo = new Repo(requireEnv("TABLE_NAME"));

/**
 * POST /admin/cards/{cardId}/transfer { reference } — record the Trump Account
 * transfer as settled (ManualOps: the admin performed the transfer out-of-band
 * and enters the confirmation number). trumpLeg -> TRANSFERRED; converges to
 * COMPLETE when the gift-card leg is done (or NONE).
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const admin = requireAdmin(event.requestContext.authorizer?.jwt?.claims);
  if (!admin) return json(403, { message: "admin only" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  let reference: string;
  try {
    reference = JSON.parse(event.body ?? "{}").reference;
    if (!reference) return json(400, { message: "transfer reference is required" });
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.trumpLeg !== TrumpLeg.VERIFIED) {
    return json(409, { message: `Trump leg must be VERIFIED to transfer (trumpLeg ${card.trumpLeg})` });
  }

  const now = new Date().toISOString();
  const actor = `admin:${admin.adminId}`;
  const patch = { trumpLeg: TrumpLeg.TRANSFERRED, trumpTransferRef: reference };
  const completes = legsSatisfyComplete(card.giftCardLeg, TrumpLeg.TRANSFERRED) && !isTerminal(card.state);

  if (completes) {
    await repo.transitionCard({
      card, to: CardState.COMPLETE, actor, reason: `funds transferred (ref ${reference}); complete`,
      patch,
      event: {
        eventId: newEventId(), cardId, orderId: card.orderId, actor,
        from: card.state, to: CardState.COMPLETE, leg: "trump",
        reason: "funds transferred", timestamp: now,
      },
    });
    return json(200, { trumpLeg: TrumpLeg.TRANSFERRED, state: CardState.COMPLETE });
  }

  await repo.saveCard({ ...card, ...patch, updatedAt: now });
  await repo.appendEvent({
    eventId: newEventId(), cardId, orderId: card.orderId, actor,
    leg: "trump", reason: `funds transferred (ref ${reference})`, timestamp: now,
  });
  return json(200, { trumpLeg: TrumpLeg.TRANSFERRED, state: card.state });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

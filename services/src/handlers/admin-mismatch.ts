import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { CardState, TrumpLeg, GiftCardLeg } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { json } from "./http";
import { requireAdmin } from "./admin-helpers";

const repo = new Repo(requireEnv("TABLE_NAME"));

/**
 * POST /admin/cards/{cardId}/mismatch { decision: "ALLOW" | "DISALLOW" } (D3, §4.1).
 * ALLOW: proceed despite the name mismatch — trumpLeg -> VERIFIED, card stays
 *        UNVERIFIED until the transfer completes (then converges to COMPLETE).
 * DISALLOW: invalidate the claim — card -> OPEN, Trump link cleared so it can be
 *        re-claimed. (Buyer-facing action; exposed here for admin/ops too.)
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const admin = requireAdmin(event.requestContext.authorizer?.jwt?.claims);
  if (!admin) return json(403, { message: "admin only" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  let decision: string;
  try {
    decision = JSON.parse(event.body ?? "{}").decision;
  } catch {
    return json(400, { message: "invalid JSON body" });
  }
  if (decision !== "ALLOW" && decision !== "DISALLOW") {
    return json(400, { message: "decision must be ALLOW or DISALLOW" });
  }

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.state !== CardState.UNVERIFIED) {
    return json(409, { message: `card is not UNVERIFIED (state ${card.state})` });
  }

  const now = new Date().toISOString();
  const actor = `admin:${admin.adminId}`;

  if (decision === "ALLOW") {
    // Stay UNVERIFIED; mark verified-by-override so the transfer can proceed.
    await repo.saveCard({
      ...card,
      trumpLeg: TrumpLeg.VERIFIED,
      mismatchDecision: "ALLOW",
      updatedAt: now,
    });
    await repo.appendEvent({
      eventId: newEventId(),
      cardId,
      orderId: card.orderId,
      actor,
      leg: "trump",
      reason: "mismatch allowed by buyer/admin",
      timestamp: now,
    });
    return json(200, { decision, trumpLeg: TrumpLeg.VERIFIED, state: CardState.UNVERIFIED });
  }

  // DISALLOW -> back to OPEN, prior claim invalidated.
  await repo.transitionCard({
    card,
    to: CardState.OPEN,
    actor,
    reason: "mismatch disallowed; claim invalidated",
    patch: {
      trumpLeg: TrumpLeg.UNLINKED,
      giftCardLeg: card.giftCardLeg === GiftCardLeg.NONE ? GiftCardLeg.NONE : GiftCardLeg.AWAITING_SELECTION,
      mismatchDecision: "DISALLOW",
      linkedTrumpAccountRef: undefined,
      verifiedAccountHolderName: undefined,
      selectedGiftCardProduct: undefined,
      claimedAt: undefined,
    },
    event: {
      eventId: newEventId(),
      cardId,
      orderId: card.orderId,
      actor,
      from: card.state,
      to: CardState.OPEN,
      reason: "mismatch disallowed",
      timestamp: now,
    },
  });
  return json(200, { decision, state: CardState.OPEN });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

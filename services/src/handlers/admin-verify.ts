import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { CardState, TrumpLeg } from "../domain/states";
import { matchNames, isOpenGift } from "../domain/verification";
import { newEventId } from "../domain/tokens";
import { json } from "./http";
import { requireAdmin } from "./admin-helpers";

const repo = new Repo(requireEnv("TABLE_NAME"));
const REQUIRE_NAME_WHEN_ABSENT = process.env.REQUIRE_NAME_MATCH_WHEN_ABSENT === "true";

/**
 * POST /admin/cards/{cardId}/verify { accountHolderName } — the admin records
 * the name seen on the linked Trump Account (ManualOps, §6.1). Runs the D3
 * name-match: MATCH/SKIPPED -> trumpLeg VERIFIED (stays CLAIMED); MISMATCH ->
 * card UNVERIFIED (buyer then allows/disallows).
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const admin = requireAdmin(event.requestContext.authorizer?.jwt?.claims);
  if (!admin) return json(403, { message: "admin only" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  let accountHolderName: string | undefined;
  try {
    accountHolderName = JSON.parse(event.body ?? "{}").accountHolderName;
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.trumpLeg !== TrumpLeg.LINKED && card.trumpLeg !== TrumpLeg.PENDING_VERIFICATION) {
    return json(409, { message: `card is not awaiting verification (trumpLeg ${card.trumpLeg})` });
  }

  // OPEN gifts skip the name check entirely (post to any account); VERIFIED gifts
  // must match the recipient name against the account holder.
  const outcome = isOpenGift(card.verificationMode, card.recipientName)
    ? "SKIPPED"
    : matchNames(card.recipientName, accountHolderName, { requireWhenAbsent: REQUIRE_NAME_WHEN_ABSENT });
  const now = new Date().toISOString();
  const actor = `admin:${admin.adminId}`;

  if (outcome === "MISMATCH") {
    await repo.transitionCard({
      card,
      to: CardState.UNVERIFIED,
      actor,
      reason: `name mismatch: buyer="${card.recipientName ?? ""}" account="${accountHolderName ?? ""}"`,
      patch: { trumpLeg: TrumpLeg.MISMATCH, verifiedAccountHolderName: accountHolderName },
      event: {
        eventId: newEventId(),
        cardId,
        orderId: card.orderId,
        actor,
        from: card.state,
        to: CardState.UNVERIFIED,
        leg: "trump",
        reason: "name mismatch",
        timestamp: now,
      },
    });
    return json(200, { outcome, state: CardState.UNVERIFIED });
  }

  // MATCH or SKIPPED -> verified; top-level state unchanged.
  await repo.saveCard({
    ...card,
    trumpLeg: TrumpLeg.VERIFIED,
    verifiedAccountHolderName: accountHolderName,
    updatedAt: now,
  });
  await repo.appendEvent({
    eventId: newEventId(),
    cardId,
    orderId: card.orderId,
    actor,
    leg: "trump",
    reason: `verified (${outcome})`,
    timestamp: now,
  });
  return json(200, { outcome, trumpLeg: TrumpLeg.VERIFIED });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

import { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { SQSClient } from "@aws-sdk/client-sqs";
import { Repo } from "../data/repo";
import { CardState, TrumpLeg } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { enqueueFunding } from "../funding/enqueue";
import { json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const sqs = new SQSClient({});
const FUNDING_QUEUE_URL = requireEnv("FUNDING_QUEUE_URL");
type Ctx = { cardId: string };

/**
 * POST /claim/link { payload } — recipient links a Trump Account by submitting
 * the QR's opaque payload (decoded in-browser; §6.1, D8/D9, O1). We treat the
 * payload as opaque, store it, set trumpLeg = LINKED, move the card to CLAIMED,
 * and kick off the async funding worker (auto-verify + contribute). Money never
 * moves on this synchronous path — we only enqueue.
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<Ctx> = async (event) => {
  const cardId = event.requestContext.authorizer.lambda.cardId;

  let payload: string;
  try {
    payload = JSON.parse(event.body ?? "{}").payload;
    if (!payload || typeof payload !== "string") return json(400, { message: "payload is required" });
  } catch {
    return json(400, { message: "invalid JSON body" });
  }

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.state !== CardState.OPEN && card.state !== CardState.AWAITING_TRUMP_ACCOUNT) {
    return json(409, { message: `cannot link from state ${card.state}` });
  }

  const now = new Date().toISOString();
  await repo.transitionCard({
    card,
    to: CardState.CLAIMED,
    actor: "recipient",
    reason: "trump account linked via QR",
    patch: { trumpLeg: TrumpLeg.LINKED, linkedTrumpAccountRef: payload, claimedAt: now },
    event: {
      eventId: newEventId(),
      cardId,
      orderId: card.orderId,
      actor: "recipient",
      from: card.state,
      to: CardState.CLAIMED,
      leg: "trump",
      reason: "linked via QR",
      timestamp: now,
    },
  });

  // Kick off async funding. Best-effort: if the enqueue fails, stamp a due
  // retry so the sweeper picks it up — the link itself already succeeded.
  try {
    await enqueueFunding(sqs, FUNDING_QUEUE_URL, cardId, "link");
  } catch (e) {
    console.error("failed to enqueue funding; scheduling sweeper pickup", cardId, e);
    await repo.saveCard({ ...card, trumpLeg: TrumpLeg.LINKED, linkedTrumpAccountRef: payload, claimedAt: now, trumpFundingRetryAt: now, updatedAt: now });
  }

  return json(200, { ok: true, state: CardState.CLAIMED });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

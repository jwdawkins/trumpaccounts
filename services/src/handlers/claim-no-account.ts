import { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { CardState } from "../domain/states";
import { newEventId } from "../domain/tokens";
import { json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
type Ctx = { cardId: string };

/**
 * POST /claim/no-account — recipient has no Trump Account yet (§7.2, D6).
 * Consumes the link and parks the card in AWAITING_TRUMP_ACCOUNT; it stays
 * revisitable so they can link later.
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<Ctx> = async (event) => {
  const cardId = event.requestContext.authorizer.lambda.cardId;

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });
  if (card.state !== CardState.OPEN) {
    return json(409, { message: `cannot park from state ${card.state}` });
  }

  const now = new Date().toISOString();
  await repo.transitionCard({
    card,
    to: CardState.AWAITING_TRUMP_ACCOUNT,
    actor: "recipient",
    reason: "recipient has no Trump Account yet",
    event: {
      eventId: newEventId(),
      cardId,
      orderId: card.orderId,
      actor: "recipient",
      from: card.state,
      to: CardState.AWAITING_TRUMP_ACCOUNT,
      timestamp: now,
    },
  });

  return json(200, { ok: true, state: CardState.AWAITING_TRUMP_ACCOUNT });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

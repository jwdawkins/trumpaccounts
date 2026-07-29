import {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from "aws-lambda";
import { Repo } from "../data/repo";
import { hashClaimToken } from "../domain/tokens";
import { CardState } from "../domain/states";

const repo = new Repo(requireEnv("TABLE_NAME"));

// Links in these states are dead — deny (regenerated / expired / refunded).
const DEAD = new Set<CardState>([CardState.VOIDED, CardState.EXPIRED, CardState.REFUNDED]);

type Ctx = { cardId: string };

/**
 * Claim-token Lambda authorizer for /claim routes (handoff §8).
 * The raw token arrives in the `x-claim-token` header; we hash it and resolve a
 * card via GSI3. Only the hash is ever compared. Injects cardId into context.
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2,
): Promise<APIGatewaySimpleAuthorizerWithContextResult<Ctx>> => {
  const deny: APIGatewaySimpleAuthorizerWithContextResult<Ctx> = {
    isAuthorized: false,
    context: { cardId: "" },
  };
  const token = event.headers?.["x-claim-token"];
  if (!token) return deny;

  const card = await repo.findCardByTokenHash(hashClaimToken(token));
  if (!card || DEAD.has(card.state)) return deny;

  return { isAuthorized: true, context: { cardId: card.cardId } };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

import { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { recipientDetails } from "../domain/recipient-view";
import { json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));

type Ctx = { cardId: string };

/**
 * GET /claim/details — recipient-facing gift details + status checklist (§7.2).
 * Auth: claim-token authorizer injects the resolved cardId (no Cognito).
 */
export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<Ctx> = async (event) => {
  const cardId = event.requestContext.authorizer.lambda.cardId;
  if (!cardId) return json(401, { message: "unauthorized" });

  const card = await repo.getCard(cardId);
  if (!card) return json(404, { message: "not found" });

  return json(200, recipientDetails(card));
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

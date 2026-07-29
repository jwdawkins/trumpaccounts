import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { getCertificate } from "../notify/store";
import { buyerIdFromEvent, json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const ASSETS_BUCKET = requireEnv("ASSETS_BUCKET");

/**
 * GET /cards/{cardId}/certificate — return the SELF-delivery gift-certificate
 * PDF for a card the caller owns. Buyer-authed + ownership-checked.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  const card = await repo.getCard(cardId);
  if (!card || card.buyerId !== buyerId) return json(404, { message: "not found" });

  const pdf = await getCertificate(ASSETS_BUCKET, cardId);
  if (!pdf) return json(404, { message: "no certificate for this card" });

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="gift-${cardId}.pdf"`,
    },
    body: Buffer.from(pdf).toString("base64"),
    isBase64Encoded: true,
  };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

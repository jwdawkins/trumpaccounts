import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { getCertificate } from "../notify/store";
import { zipCertificates } from "../notify/order-certificates";
import { buyerIdFromEvent, json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const ASSETS_BUCKET = requireEnv("ASSETS_BUCKET");

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * GET /orders/{orderId}/certificates.zip — a zip of one PDF per card for an
 * order the caller owns. Buyer-authed + ownership-checked.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  const orderId = event.pathParameters?.orderId;
  if (!orderId) return json(400, { message: "orderId required" });

  const found = await repo.getOrderWithCards(orderId);
  if (!found || found.order.buyerId !== buyerId) return json(404, { message: "not found" });

  const entries: { name: string; pdf: Uint8Array }[] = [];
  for (let i = 0; i < found.cards.length; i++) {
    const card = found.cards[i];
    const pdf = await getCertificate(ASSETS_BUCKET, card.cardId);
    if (!pdf) continue;
    const label = card.recipientName ? slug(card.recipientName) : `card-${i + 1}`;
    entries.push({ name: `gift-${i + 1}-${label}.pdf`, pdf });
  }
  if (entries.length === 0) return json(404, { message: "no certificates yet" });

  const zip = await zipCertificates(entries);
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="gifts-${orderId}.zip"`,
    },
    body: Buffer.from(zip).toString("base64"),
    isBase64Encoded: true,
  };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

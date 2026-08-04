import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { getCertificate } from "../notify/store";
import { mergeCertificates } from "../notify/order-certificates";
import { buyerIdFromEvent, json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const ASSETS_BUCKET = requireEnv("ASSETS_BUCKET");

/**
 * GET /orders/{orderId}/certificate — a single combined PDF (one card per page)
 * for every card in an order the caller owns. Buyer-authed + ownership-checked.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  const orderId = event.pathParameters?.orderId;
  if (!orderId) return json(400, { message: "orderId required" });

  const found = await repo.getOrderWithCards(orderId);
  if (!found || found.order.buyerId !== buyerId) return json(404, { message: "not found" });

  const pdfs: Uint8Array[] = [];
  for (const card of found.cards) {
    const pdf = await getCertificate(ASSETS_BUCKET, card.cardId);
    if (pdf) pdfs.push(pdf);
  }
  if (pdfs.length === 0) return json(404, { message: "no certificates yet" });

  const merged = await mergeCertificates(pdfs);
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="gift-${orderId}.pdf"`,
    },
    body: Buffer.from(merged).toString("base64"),
    isBase64Encoded: true,
  };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

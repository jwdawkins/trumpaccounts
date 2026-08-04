import { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { Repo } from "../data/repo";
import { getCertificate } from "../notify/store";
import { buildForwardGiftHtml } from "../notify/email";
import { sendBrevoEmail } from "../notify/brevo";
import { buyerIdFromEvent, json } from "./http";

const repo = new Repo(requireEnv("TABLE_NAME"));
const ASSETS_BUCKET = requireEnv("ASSETS_BUCKET");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * POST /cards/{cardId}/send-email  { email } — for a SELF-delivery card the
 * buyer owns, email the gift certificate PDF to an address they enter. The
 * certificate embeds the claim QR/link, so no token needs to leave the PDF.
 */
export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const buyerId = buyerIdFromEvent(event.requestContext.authorizer?.jwt?.claims);
  if (!buyerId) return json(401, { message: "unauthenticated" });

  const cardId = event.pathParameters?.cardId;
  if (!cardId) return json(400, { message: "cardId required" });

  let email = "";
  try {
    email = (JSON.parse(event.body ?? "{}").email ?? "").trim();
  } catch {
    return json(400, { message: "invalid body" });
  }
  if (!EMAIL_RE.test(email)) return json(400, { message: "valid email required" });

  const card = await repo.getCard(cardId);
  if (!card || card.buyerId !== buyerId) return json(404, { message: "not found" });

  const pdf = await getCertificate(ASSETS_BUCKET, cardId);
  if (!pdf) return json(404, { message: "no certificate for this card" });

  await sendBrevoEmail({
    to: email,
    subject: "You've received a gift",
    html: buildForwardGiftHtml({
      recipientName: card.recipientName,
      message: card.message,
      amountCents: card.totalAmount,
      brandName: card.brandName,
    }),
    attachments: [{ name: "trump-account-gift.pdf", content: Buffer.from(pdf).toString("base64") }],
  });

  return json(200, { ok: true });
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

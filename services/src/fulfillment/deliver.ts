import { Card } from "../domain/types";
import { sendClaimEmail } from "../notify/email";
import { generateCertificatePdf } from "../notify/pdf";
import { storeCertificate } from "../notify/store";

/** Build the recipient claim URL from a raw token. */
export function claimUrl(webBaseUrl: string, rawToken: string): string {
  return `${webBaseUrl.replace(/\/$/, "")}/claim/${rawToken}`;
}

const PLACEHOLDER_FROM = "no-reply@example.com";

/**
 * Deliver a claim (§6.4 / D2).
 *
 * A downloadable PDF gift certificate (QR of the claim link) is ALWAYS
 * generated and stored in the private assets bucket, so every gift can be
 * downloaded/shared regardless of channel. On top of that:
 *   EMAIL → also emailed via SES (best-effort; skipped/logged if SES isn't
 *           configured yet, so it never blocks fulfillment)
 *   SMS   → ON HOLD (logged) until Twilio is wired
 *
 * The raw token is used here and never persisted (§8); it lives only inside the
 * stored certificate PDF in the private, encrypted bucket.
 */
export async function dispatchDelivery(
  card: Card,
  rawToken: string,
  webBaseUrl: string,
): Promise<void> {
  const url = claimUrl(webBaseUrl, rawToken);

  // Always produce a downloadable certificate.
  const pdf = await generateCertificatePdf({
    recipientName: card.recipientName,
    message: card.message,
    amountCents: card.totalAmount,
    claimUrl: url,
  });
  await storeCertificate(requireEnv("ASSETS_BUCKET"), card.cardId, pdf);

  // Channel-specific delivery on top.
  const from = process.env.SES_FROM_ADDRESS;
  if (card.deliveryMethod === "EMAIL" && card.recipientEmail && from && from !== PLACEHOLDER_FROM) {
    try {
      await sendClaimEmail({
        to: card.recipientEmail,
        fromAddress: from,
        recipientName: card.recipientName,
        claimUrl: url,
      });
    } catch (e) {
      console.warn(
        JSON.stringify({ msg: "email delivery failed", cardId: card.cardId, error: (e as Error).message }),
      );
    }
  } else if (card.deliveryMethod === "SMS") {
    console.log(JSON.stringify({ msg: "SMS delivery on hold (Twilio pending)", cardId: card.cardId }));
  } else if (card.deliveryMethod === "EMAIL") {
    console.log(JSON.stringify({ msg: "email skipped (SES sender not configured)", cardId: card.cardId }));
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

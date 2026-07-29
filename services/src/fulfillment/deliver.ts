import { Card } from "../domain/types";
import { sendClaimEmail } from "../notify/email";
import { generateCertificatePdf } from "../notify/pdf";
import { storeCertificate } from "../notify/store";

/** Build the recipient claim URL from a raw token. */
export function claimUrl(webBaseUrl: string, rawToken: string): string {
  return `${webBaseUrl.replace(/\/$/, "")}/claim/${rawToken}`;
}

/**
 * Dispatch a claim to the recipient by the card's delivery method (§6.4 / D2):
 *   EMAIL → SES email with the claim link
 *   SELF  → generate a PDF gift certificate (QR of the claim link) → private S3
 *   SMS   → ON HOLD (logged) until Twilio is wired
 *
 * The raw token is used here and never persisted (§8); for SELF it lives only
 * inside the stored certificate PDF in the private, encrypted assets bucket.
 */
export async function dispatchDelivery(
  card: Card,
  rawToken: string,
  webBaseUrl: string,
): Promise<void> {
  const url = claimUrl(webBaseUrl, rawToken);

  switch (card.deliveryMethod) {
    case "EMAIL": {
      if (!card.recipientEmail) return;
      await sendClaimEmail({
        to: card.recipientEmail,
        fromAddress: requireEnv("SES_FROM_ADDRESS"),
        recipientName: card.recipientName,
        claimUrl: url,
      });
      return;
    }
    case "SELF": {
      const pdf = await generateCertificatePdf({
        recipientName: card.recipientName,
        message: card.message,
        amountCents: card.totalAmount,
        claimUrl: url,
      });
      await storeCertificate(requireEnv("ASSETS_BUCKET"), card.cardId, pdf);
      return;
    }
    case "SMS": {
      console.log(JSON.stringify({ msg: "SMS delivery on hold (Twilio pending)", cardId: card.cardId }));
      return;
    }
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

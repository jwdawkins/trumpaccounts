import { Card } from "../domain/types";
import { sendClaimEmail } from "../notify/email";
import { generateCertificatePdf } from "../notify/pdf";
import { storeCertificate } from "../notify/store";

/** Build the recipient claim URL from a raw token. */
export function claimUrl(webBaseUrl: string, rawToken: string): string {
  return `${webBaseUrl.replace(/\/$/, "")}/claim/${rawToken}`;
}

/**
 * Deliver a claim (§6.4 / D2).
 *
 * A downloadable PDF gift certificate (QR of the claim link) is ALWAYS generated
 * and stored, so every gift can be downloaded/shared regardless of channel. On
 * top of that, for EMAIL delivery:
 *   - if the scheduled send date is due (today/past, or none) → email now via
 *     Brevo (claim email + the certificate attached), and report emailSent.
 *   - if the send date is in the future → HELD; the daily dispatcher sends it on
 *     the date. SMS is on hold (Twilio pending). SELF is PDF-only.
 *
 * The raw token is used here and never persisted (§8); it lives only inside the
 * stored certificate PDF and (for a due send) the email we send now.
 */
export async function dispatchDelivery(
  card: Card,
  rawToken: string,
  webBaseUrl: string,
): Promise<{ emailSent: boolean }> {
  const url = claimUrl(webBaseUrl, rawToken);

  const content = {
    recipientName: card.recipientName,
    message: card.message,
    amountCents: card.totalAmount,
    trumpPercent: card.trumpPercent,
    brandName: card.brandName,
    claimUrl: url,
  };
  const pdf = await generateCertificatePdf(content);
  await storeCertificate(requireEnv("ASSETS_BUCKET"), card.cardId, pdf);

  if (card.deliveryMethod === "EMAIL" && card.recipientEmail) {
    const today = new Date().toISOString().slice(0, 10);
    const due = !card.sendDate || card.sendDate <= today;
    if (due) {
      try {
        await sendClaimEmail(card.recipientEmail, content, pdf);
        return { emailSent: true };
      } catch (e) {
        console.warn(
          JSON.stringify({ msg: "email delivery failed", cardId: card.cardId, error: (e as Error).message }),
        );
        return { emailSent: false };
      }
    }
    console.log(JSON.stringify({ msg: "email held for scheduled send date", cardId: card.cardId, sendDate: card.sendDate }));
  } else if (card.deliveryMethod === "SMS") {
    console.log(JSON.stringify({ msg: "SMS delivery on hold (Twilio pending)", cardId: card.cardId }));
  }
  return { emailSent: false };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

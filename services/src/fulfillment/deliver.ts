import { Card } from "../domain/types";

/** Build the recipient claim URL from a raw token (never logged with PII). */
export function claimUrl(webBaseUrl: string, rawToken: string): string {
  return `${webBaseUrl.replace(/\/$/, "")}/claim/${rawToken}`;
}

/**
 * Dispatch a claim link to the recipient (handoff §6.4 / D2).
 *
 * M2 STUB: logs the delivery intent only. #12 replaces this with the real
 * NotificationProvider (SES email / Twilio SMS / generated PDF for SELF),
 * keeping this call-site stable. No card amounts in any subject line (§8).
 */
export async function dispatchDelivery(
  card: Card,
  rawToken: string,
  webBaseUrl: string,
): Promise<void> {
  const url = claimUrl(webBaseUrl, rawToken);
  // Deliberately avoid logging the raw token in production paths; dev-only trace.
  console.log(
    JSON.stringify({
      msg: "delivery.dispatch (stub)",
      cardId: card.cardId,
      method: card.deliveryMethod,
      hasEmail: Boolean(card.recipientEmail),
      hasPhone: Boolean(card.recipientPhone),
      claimUrlPreview: `${url.slice(0, url.length - 8)}…`,
    }),
  );
}

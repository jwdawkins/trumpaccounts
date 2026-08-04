import { ScheduledHandler } from "aws-lambda";
import { Repo } from "../data/repo";
import { getCertificate } from "../notify/store";
import { buildForwardGiftHtml } from "../notify/email";
import { sendBrevoEmail } from "../notify/brevo";

const repo = new Repo(requireEnv("TABLE_NAME"));
const ASSETS_BUCKET = requireEnv("ASSETS_BUCKET");

/**
 * Daily dispatcher — sends the gifts whose scheduled send date has arrived.
 * Runs each morning: finds OPEN email cards due today (or overdue) that haven't
 * been sent, and emails the stored certificate PDF (which embeds the claim QR)
 * via Brevo. Idempotent via `deliverySentAt`. The raw claim token isn't
 * persisted, so a deferred send attaches the certificate rather than a link.
 */
export const handler: ScheduledHandler = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const due = await repo.listScheduledDeliveriesDue(today);
  console.log(JSON.stringify({ msg: "scheduled dispatch run", today, due: due.length }));

  for (const card of due) {
    if (!card.recipientEmail) continue;
    try {
      const pdf = await getCertificate(ASSETS_BUCKET, card.cardId);
      await sendBrevoEmail({
        to: card.recipientEmail,
        subject: "You've received a gift",
        html: buildForwardGiftHtml({
          recipientName: card.recipientName,
          message: card.message,
          amountCents: card.totalAmount,
          brandName: card.brandName,
        }),
        attachments: pdf ? [{ name: "trump-account-gift.pdf", content: Buffer.from(pdf).toString("base64") }] : undefined,
      });
      const now = new Date().toISOString();
      await repo.saveCard({ ...card, deliverySentAt: now, updatedAt: now });
    } catch (e) {
      console.warn(JSON.stringify({ msg: "scheduled dispatch failed", cardId: card.cardId, error: (e as Error).message }));
    }
  }
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

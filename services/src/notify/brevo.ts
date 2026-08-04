import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

/**
 * Brevo transactional email sender (REST). Reads the same secret the Cognito
 * custom-email-sender uses (apiKey + verified senderEmail/senderName).
 */
const sm = new SecretsManagerClient({});
const SECRET_ARN = process.env.BREVO_SECRET_ARN;
let cached: { apiKey: string; senderEmail: string; senderName: string } | null = null;

async function cfg() {
  if (cached) return cached;
  if (!SECRET_ARN) throw new Error("BREVO_SECRET_ARN not set");
  const res = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
  const p = JSON.parse(res.SecretString ?? "{}");
  cached = {
    apiKey: p.apiKey ?? "",
    senderEmail: p.senderEmail ?? "",
    senderName: p.senderName ?? "Trump Account Gift Cards",
  };
  return cached;
}

export interface BrevoEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Attachments: { name, content } where content is base64. */
  attachments?: { name: string; content: string }[];
}

export async function sendBrevoEmail(email: BrevoEmail): Promise<void> {
  const { apiKey, senderEmail, senderName } = await cfg();
  if (!apiKey || !senderEmail) throw new Error("Brevo not configured (apiKey/senderEmail)");
  const body: Record<string, unknown> = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: email.to }],
    subject: email.subject,
    htmlContent: email.html,
  };
  if (email.text) body.textContent = email.text;
  if (email.attachments?.length) body.attachment = email.attachments;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
}

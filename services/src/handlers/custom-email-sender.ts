import {
  buildClient,
  CommitmentPolicy,
  KmsKeyringNode,
} from "@aws-crypto/client-node";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

/**
 * Cognito CustomEmailSender trigger → Brevo.
 *
 * When the user pool would send an email (sign-up verification code, EMAIL_OTP
 * sign-in code, resend, etc.), Cognito instead invokes this Lambda with the code
 * ENCRYPTED under our KMS key. We decrypt it with the AWS Encryption SDK and send
 * a branded email through Brevo's transactional API. Because a CustomEmailSender
 * is configured, Cognito no longer sends any email itself — so this must succeed
 * for auth to work (the Brevo secret must hold a real apiKey + verified sender).
 */

const KEY_ARN = process.env.CUSTOM_SENDER_KEY_ARN!;
const BREVO_SECRET_ARN = process.env.BREVO_SECRET_ARN!;

const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);
const keyring = new KmsKeyringNode({ keyIds: [KEY_ARN] });

const sm = new SecretsManagerClient({});
let cachedBrevo: { apiKey: string; senderEmail: string; senderName: string } | null = null;

async function getBrevoConfig() {
  if (cachedBrevo) return cachedBrevo;
  const res = await sm.send(new GetSecretValueCommand({ SecretId: BREVO_SECRET_ARN }));
  const parsed = JSON.parse(res.SecretString ?? "{}");
  cachedBrevo = {
    apiKey: parsed.apiKey ?? "",
    senderEmail: parsed.senderEmail ?? "",
    senderName: parsed.senderName ?? "Trump Account Gift Cards",
  };
  return cachedBrevo;
}

interface CustomEmailSenderEvent {
  triggerSource: string;
  request: {
    type: string;
    code?: string; // base64 of the KMS-encrypted code
    userAttributes: Record<string, string>;
  };
}

/** Copy varies slightly by why the code was sent, but it's always a 6-digit code. */
function subjectFor(triggerSource: string): string {
  switch (triggerSource) {
    case "CustomEmailSender_ForgotPassword":
      return "Your password reset code";
    case "CustomEmailSender_UpdateUserAttribute":
    case "CustomEmailSender_VerifyUserAttribute":
      return "Verify your email";
    default:
      return "Your sign-in code";
  }
}

function bodyHtml(code: string): string {
  return `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:460px;margin:auto;background:#060D18;color:#fff;padding:32px;border-radius:12px">
      <div style="display:inline-block;border:2px solid #C79E4D;border-radius:8px;width:44px;height:44px;line-height:44px;text-align:center;color:#C79E4D;font-weight:700;font-size:22px">T</div>
      <h2 style="color:#C79E4D;margin:20px 0 4px">Your sign-in code</h2>
      <p style="color:#c9d3e0;font-size:14px;margin:0 0 20px">Enter this code to finish checking out with Trump Account Gift Cards.</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#fff;background:#0A1B33;border:1px solid rgba(199,158,77,.4);border-radius:8px;padding:16px;text-align:center">${code}</div>
      <p style="color:#8994a6;font-size:12px;margin-top:20px">This code expires shortly. If you didn't request it, you can ignore this email.</p>
    </div>`;
}

export async function handler(event: CustomEmailSenderEvent): Promise<void> {
  // Only the code-bearing triggers need an email from us.
  if (!event.request?.code) return;
  const email = event.request.userAttributes?.email;
  if (!email) return;

  // Decrypt the code Cognito encrypted under our KMS key.
  const { plaintext } = await decrypt(keyring, Buffer.from(event.request.code, "base64"));
  const code = plaintext.toString("utf-8");

  const { apiKey, senderEmail, senderName } = await getBrevoConfig();
  if (!apiKey || !senderEmail) {
    throw new Error("Brevo not configured: set apiKey + senderEmail in the brevo secret");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email }],
      subject: subjectFor(event.triggerSource),
      htmlContent: bodyHtml(code),
      textContent: `Your Trump Account Gift Cards sign-in code is ${code}. It expires shortly.`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
}

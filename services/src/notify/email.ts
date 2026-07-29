import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({});

export interface ClaimEmailInput {
  to: string;
  fromAddress: string;
  recipientName?: string;
  claimUrl: string;
}

/**
 * Send the claim invite via SES (§6.4). No card amounts in the subject line (§8).
 */
export async function sendClaimEmail(input: ClaimEmailInput): Promise<void> {
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#111">You&rsquo;ve received a gift 🎁</h2>
      <p>${greeting}</p>
      <p>Someone sent you a gift toward a Trump Account, with an optional gift card.</p>
      <p style="margin:28px 0">
        <a href="${input.claimUrl}"
           style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
          Claim your gift
        </a>
      </p>
      <p style="color:#667;font-size:13px">Or paste this link: ${input.claimUrl}</p>
    </div>`;
  const text = `${greeting}\n\nYou've received a gift toward a Trump Account.\nClaim it: ${input.claimUrl}`;

  await client.send(
    new SendEmailCommand({
      FromEmailAddress: input.fromAddress,
      Destination: { ToAddresses: [input.to] },
      Content: {
        Simple: {
          Subject: { Data: "You've received a gift" },
          Body: { Html: { Data: html }, Text: { Data: text } },
        },
      },
    }),
  );
}

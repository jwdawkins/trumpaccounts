import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  computeGiftSummary,
  formatDollars,
  formatCents,
  TRUMP_ACCOUNT_FACTS,
  PROJECTION_DISCLAIMER,
  RETURN_LABEL,
  BRAND,
} from "./gift-summary";

const client = new SESv2Client({});

export interface ClaimEmailInput {
  to: string;
  fromAddress: string;
  recipientName?: string;
  message?: string;
  amountCents: number;
  trumpPercent: number;
  /** Selected spendable-card brand, e.g. "Amazon" / "Visa Gift Card". */
  brandName?: string;
  claimUrl: string;
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Hosted brand logo (faded art on the marketing site) for the email card. */
const BRAND_LOGO_BASE = "https://trumpaccountgiftcards.com/brands";
function brandLogoUrl(brandName?: string): string | null {
  if (!brandName) return null;
  const n = brandName.toLowerCase();
  for (const key of ["amazon", "visa", "starbucks", "walmart"]) {
    if (n.includes(key)) return `${BRAND_LOGO_BASE}/${key}.png`;
  }
  return null;
}

/** The gift-reveal email: the built card, projected value, primer, claim CTA. */
export function buildClaimEmailHtml(input: ClaimEmailInput): string {
  const s = computeGiftSummary(input.amountCents, input.trumpPercent);
  const logoUrl = brandLogoUrl(input.brandName);
  const greeting = input.recipientName ? `Hi ${esc(input.recipientName)},` : "Hi,";
  const facts = TRUMP_ACCOUNT_FACTS.map(
    (f) =>
      `<tr><td style="vertical-align:top;color:${BRAND.gold};padding:3px 8px 3px 0;font-size:13px">&bull;</td>` +
      `<td style="vertical-align:top;color:#c9d3e0;font-size:13px;line-height:1.4;padding-bottom:3px">${esc(f)}</td></tr>`,
  ).join("");

  return `
  <div style="background:${BRAND.paper};padding:24px 12px">
    <div style="max-width:480px;margin:0 auto;background:${BRAND.navy};border:1px solid rgba(199,158,77,.3);border-radius:14px;padding:32px;color:#ffffff">

      <!-- Logo lockup -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px">
        <tr>
          <td style="vertical-align:middle;padding-right:12px">
            <div style="width:44px;height:44px;border:2px solid ${BRAND.gold};text-align:center;line-height:42px;color:${BRAND.gold};font-family:Georgia,serif;font-weight:700;font-size:24px">T</div>
          </td>
          <td style="vertical-align:middle">
            <div style="font-family:Georgia,serif;font-weight:700;font-size:16px;letter-spacing:2px;color:#fff;text-transform:uppercase;line-height:1.15">Trump Account</div>
            <div style="font-family:Georgia,serif;font-weight:600;font-size:11px;letter-spacing:3px;color:${BRAND.gold};text-transform:uppercase;margin-top:3px">Gift Card</div>
          </td>
        </tr>
      </table>

      <h1 style="font-family:Georgia,serif;color:${BRAND.gold};font-size:24px;margin:0 0 6px">You&rsquo;ve received a gift &#127873;</h1>
      <p style="color:#c9d3e0;font-size:14px;margin:0 0 22px;font-family:system-ui,Arial,sans-serif">${greeting} someone sent you a gift toward your future &mdash; cash to spend today, plus an investment in a tax-advantaged Trump Account.</p>

      <!-- The built card -->
      <div style="background:${BRAND.navyLift};border:1px solid rgba(199,158,77,.35);border-radius:10px;padding:22px;margin-bottom:8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:top">
              ${
                input.brandName
                  ? `<div style="font-size:10px;letter-spacing:2px;color:${BRAND.gold};font-weight:700;text-transform:uppercase;margin-bottom:6px;font-family:system-ui,Arial,sans-serif">${esc(input.brandName)} gift card</div>`
                  : ""
              }
              <div style="font-family:Georgia,serif;font-size:34px;font-weight:700;color:#fff">${formatDollars(input.amountCents)}</div>
            </td>
            ${
              logoUrl
                ? `<td style="vertical-align:top;text-align:right;width:104px"><img src="${logoUrl}" alt="${esc(input.brandName || "")}" width="96" height="96" style="display:block;margin-left:auto;border:0"></td>`
                : ""
            }
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:16px">
          <tr style="height:10px">
            <td style="width:${s.trumpPercent}%;background:${BRAND.gold};font-size:0;line-height:10px">&nbsp;</td>
            <td style="width:${100 - s.trumpPercent}%;background:#ffffff;font-size:0;line-height:10px">&nbsp;</td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">
          <tr>
            <td style="text-align:left;font-family:system-ui,Arial,sans-serif">
              <div style="font-size:9px;letter-spacing:1px;color:${BRAND.gold};font-weight:700">INVESTED</div>
              <div style="font-size:14px;font-weight:700;color:#fff">${formatCents(s.investedCents)}</div>
            </td>
            <td style="text-align:right;font-family:system-ui,Arial,sans-serif">
              <div style="font-size:9px;letter-spacing:1px;color:#c9d3e0;font-weight:700">SPENDABLE</div>
              <div style="font-size:14px;font-weight:700;color:#fff">${formatCents(s.spendableCents)}</div>
            </td>
          </tr>
        </table>
      </div>

      ${
        input.message
          ? `<p style="color:#aeb8c7;font-style:italic;font-size:13px;text-align:center;margin:16px 8px;font-family:system-ui,Arial,sans-serif">&ldquo;${esc(input.message)}&rdquo;</p>`
          : ""
      }

      <!-- Infographics -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0">
        <tr>
          <td style="width:50%;padding-right:5px;vertical-align:top">
            <div style="border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:14px 8px;text-align:center">
              <div style="font-size:9px;letter-spacing:1px;color:#c9d3e0;font-weight:700;font-family:system-ui,Arial,sans-serif">TRUE GIFT VALUE</div>
              <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#fff;margin:6px 0">${formatDollars(s.trueGiftValueCents)}</div>
              <div style="font-size:9px;color:#8994a6;font-family:system-ui,Arial,sans-serif">to spend + Trump Account by 18</div>
            </div>
          </td>
          <td style="width:50%;padding-left:5px;vertical-align:top">
            <div style="border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:14px 8px;text-align:center">
              <div style="font-size:9px;letter-spacing:1px;color:#c9d3e0;font-weight:700;font-family:system-ui,Arial,sans-serif">IF KEPT TO RETIREMENT (65)</div>
              <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#fff;margin:6px 0">${formatDollars(s.projectedAt65Cents)}</div>
              <div style="font-size:9px;color:#8994a6;font-family:system-ui,Arial,sans-serif">${RETURN_LABEL}</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Claim CTA -->
      <div style="text-align:center;margin:26px 0">
        <a href="${input.claimUrl}" style="display:inline-block;background:${BRAND.gold};color:${BRAND.navy};font-family:Georgia,serif;font-weight:700;font-size:16px;text-decoration:none;padding:14px 36px;border-radius:6px">Claim Your Gift</a>
        <div style="color:#8994a6;font-size:11px;margin-top:10px;font-family:system-ui,Arial,sans-serif">or visit ${input.claimUrl}</div>
      </div>

      <!-- Primer -->
      <div style="border-top:1px solid rgba(255,255,255,.12);padding-top:20px;margin-top:8px">
        <div style="color:${BRAND.gold};font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;font-family:system-ui,Arial,sans-serif">What is a Trump Account?</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:system-ui,Arial,sans-serif">${facts}</table>
      </div>

      <p style="color:#6b7688;font-size:10px;margin-top:22px;line-height:1.4;font-family:system-ui,Arial,sans-serif">${PROJECTION_DISCLAIMER}</p>
    </div>
  </div>`;
}

function textVersion(input: ClaimEmailInput): string {
  const s = computeGiftSummary(input.amountCents, input.trumpPercent);
  return [
    input.recipientName ? `Hi ${input.recipientName},` : "Hi,",
    "",
    `You've received a ${formatDollars(input.amountCents)} gift toward a Trump Account + gift card.`,
    `Spendable now: ${formatCents(s.spendableCents)} | Invested: ${formatCents(s.investedCents)}`,
    `True gift value: ${formatDollars(s.trueGiftValueCents)} (by age 18).`,
    input.message ? `\n"${input.message}"\n` : "",
    `Claim your gift: ${input.claimUrl}`,
  ].join("\n");
}

/** Send the gift-reveal / claim email via SES (§6.4). No amounts in the subject (§8). */
export async function sendClaimEmail(input: ClaimEmailInput): Promise<void> {
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: input.fromAddress,
      Destination: { ToAddresses: [input.to] },
      Content: {
        Simple: {
          Subject: { Data: "You've received a gift" },
          Body: {
            Html: { Data: buildClaimEmailHtml(input) },
            Text: { Data: textVersion(input) },
          },
        },
      },
    }),
  );
}

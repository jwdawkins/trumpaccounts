import { DeliveryMethod } from "../domain/types";
import { sendBrevoEmail } from "./brevo";
import {
  computeGiftSummary,
  formatDollars,
  formatCents,
  TRUMP_ACCOUNT_FACTS,
  PROJECTION_DISCLAIMER,
  RETURN_LABEL,
  BRAND,
  verifiedNotice,
} from "./gift-summary";

/*
 * Outlook (Windows) renders email with the Word engine — no div backgrounds,
 * no max-width, no border-radius, no background on styled <a>. So every layout
 * container here is a role="presentation" table with a bgcolor attribute, widths
 * are fixed/px, buttons are "bulletproof" (bgcolor <td> + padded <a>), and
 * border-radius is a progressive nicety (square in Outlook is fine).
 */

const gold = BRAND.gold; // #C79E4D
const navy = BRAND.navy; // #060D18
const navyLift = BRAND.navyLift; // #0A1B33
const paper = BRAND.paper; // #02060D
const BORDER = "#33302a"; // subtle gold-tinted border on dark
const BORDER_DIM = "#2a2f38";
const SANS = "font-family:Helvetica,Arial,sans-serif";
const SERIF = "font-family:Georgia,'Times New Roman',serif";

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

/** Full HTML document: outer paper bg + fixed-width navy card. Outlook-safe. */
const shell = (inner: string) => `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<!--[if mso]><style>table,td{mso-table-lspace:0;mso-table-rspace:0}img{-ms-interpolation-mode:bicubic}</style><![endif]-->
<title>Trump Account Gift Cards</title>
</head>
<body style="margin:0;padding:0;background-color:${paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${paper}" style="background-color:${paper};margin:0;padding:0">
  <tr>
    <td align="center" style="padding:24px 12px">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="${navy}" style="width:100%;max-width:480px;background-color:${navy}">
        <tr>
          <td bgcolor="${navy}" style="background-color:${navy};padding:30px;border:1px solid ${BORDER};color:#ffffff">
            ${inner}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

/** The T-box / TRUMP ACCOUNT / GIFT CARD lockup (table-based for Outlook). */
function lockup(): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px">
        <tr>
          <td valign="middle" style="padding-right:12px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;border:2px solid ${gold};${SERIF};font-weight:700;font-size:24px;line-height:44px;color:${gold};text-align:center">T</td>
              </tr>
            </table>
          </td>
          <td valign="middle">
            <div style="${SERIF};font-weight:700;font-size:16px;letter-spacing:2px;color:#ffffff;text-transform:uppercase;line-height:1.2">Trump Account</div>
            <div style="${SERIF};font-weight:600;font-size:11px;letter-spacing:3px;color:${gold};text-transform:uppercase">Gift Card</div>
          </td>
        </tr>
      </table>`;
}

/** Bulletproof gold button — VML for Outlook, styled anchor for everyone else. */
function button(href: string, label: string, width = 220): string {
  return `
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="12%" strokecolor="${gold}" fillcolor="${gold}">
        <w:anchorlock/>
        <center style="color:${navy};${SERIF};font-size:16px;font-weight:bold;">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" style="background-color:${gold};border-radius:6px;color:${navy};display:inline-block;${SERIF};font-size:16px;font-weight:700;line-height:48px;text-align:center;text-decoration:none;width:${width}px">${label}</a>
      <!--<![endif]-->`;
}

export interface ForwardGiftInput {
  recipientName?: string;
  message?: string;
  amountCents: number;
  brandName?: string;
}

/** On-demand "email it yourself" — short note; the certificate PDF is attached. */
export function buildForwardGiftHtml(input: ForwardGiftInput): string {
  const greeting = input.recipientName ? `Hi ${esc(input.recipientName)},` : "Hi,";
  const brand = input.brandName ? ` (a ${esc(input.brandName)} gift card)` : "";
  return shell(`
      ${lockup()}
      <div style="${SERIF};color:${gold};font-size:22px;font-weight:700;margin:0 0 8px">You&rsquo;ve received a gift &#127873;</div>
      <p style="color:#c9d3e0;font-size:14px;line-height:1.5;margin:0 0 16px;${SANS}">${greeting} you&rsquo;ve been sent a ${formatDollars(input.amountCents)} gift toward a Trump Account${brand}. Your gift certificate is attached &mdash; open the PDF and scan the QR (or use the link inside) to claim it.</p>
      ${
        input.message
          ? `<p style="color:#aeb8c7;font-style:italic;font-size:13px;margin:0 0 16px;${SANS}">&ldquo;${esc(input.message)}&rdquo;</p>`
          : ""
      }
      <p style="color:#6b7688;font-size:11px;margin:20px 0 0;${SANS}">Sent via Trump Account Gift Cards.</p>`);
}

export interface OrderSummaryCard {
  recipientName?: string;
  amountCents: number;
  trumpPercent: number;
  brandName?: string;
  deliveryMethod: DeliveryMethod;
  recipientEmail?: string;
  recipientPhone?: string;
  sendDate?: string;
}
export interface OrderSummaryInput {
  statusUrl: string;
  cards: OrderSummaryCard[];
}

function deliveryLine(c: OrderSummaryCard): string {
  if (c.deliveryMethod === "SELF") return "You deliver this one yourself";
  const when = c.sendDate ? ` on ${c.sendDate}` : "";
  if (c.deliveryMethod === "EMAIL") return `Emails ${esc(c.recipientEmail ?? "the recipient")}${when}`;
  return `Texts ${esc(c.recipientPhone ?? "the recipient")}${when}`;
}

/** Buyer order-summary email: one email per order, a row per card + status link. */
export function buildOrderSummaryHtml(input: OrderSummaryInput): string {
  const blocks = input.cards
    .map((c) => {
      const s = computeGiftSummary(c.amountCents, c.trumpPercent);
      const cardInput: ClaimEmailInput = {
        recipientName: c.recipientName,
        amountCents: c.amountCents,
        trumpPercent: c.trumpPercent,
        brandName: c.brandName,
        claimUrl: "",
      };
      return `${cardBlock(cardInput, s)}<p style="color:#8994a6;font-size:12px;line-height:1.5;margin:6px 0 18px;${SANS}">${deliveryLine(c)}</p>`;
    })
    .join("");
  const count = input.cards.length;
  return shell(`
      ${lockup()}
      <div style="${SERIF};color:${gold};font-size:22px;font-weight:700;margin:0 0 10px">Your gift is confirmed &#127873;</div>
      <p style="color:#c9d3e0;font-size:14px;line-height:1.5;margin:0 0 18px;${SANS}">Thank you &mdash; your gift is confirmed. Once the recipient claims the gift, we&rsquo;ll ensure their Trump Account is funded and then they can redeem their gift card. The certificate PDF${count > 1 ? "s are" : " is"} attached.</p>
      ${blocks}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 0 8px">${button(
        input.statusUrl,
        count > 1 ? "Check your gifts" : "Check your gift",
      )}</td></tr></table>
      <p style="color:#6b7688;font-size:11px;margin:16px 0 0;${SANS}">Track status, download certificates, and manage delivery any time from the link above.</p>`);
}

/** The gift card block: brand + amount + logo, split bar, invested/spendable. */
function cardBlock(input: ClaimEmailInput, s: ReturnType<typeof computeGiftSummary>): string {
  const logoUrl = brandLogoUrl(input.brandName);
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${navyLift}" style="background-color:${navyLift};border:1px solid ${BORDER}">
        <tr>
          <td style="padding:22px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top">
                  ${
                    input.brandName
                      ? `<div style="font-size:10px;letter-spacing:2px;color:${gold};font-weight:700;text-transform:uppercase;margin-bottom:6px;${SANS}">${esc(input.brandName)} gift card</div>`
                      : ""
                  }
                  <div style="${SERIF};font-size:34px;font-weight:700;color:#ffffff">${formatDollars(input.amountCents)}</div>
                  ${
                    input.recipientName
                      ? `<div style="font-size:9px;letter-spacing:1px;color:${gold};font-weight:700;text-transform:uppercase;margin-top:8px;${SANS}">To</div><div style="${SERIF};font-size:15px;font-weight:700;color:#ffffff">${esc(input.recipientName)}</div>`
                      : ""
                  }
                </td>
                ${
                  logoUrl
                    ? `<td valign="top" align="right" width="96"><img src="${logoUrl}" alt="${esc(input.brandName || "")}" width="96" height="96" style="display:block;border:0"></td>`
                    : ""
                }
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:16px">
              <tr>
                <td bgcolor="${gold}" width="${s.trumpPercent}%" height="10" style="background-color:${gold};height:10px;font-size:0;line-height:0">&nbsp;</td>
                <td bgcolor="#ffffff" width="${100 - s.trumpPercent}%" height="10" style="background-color:#ffffff;height:10px;font-size:0;line-height:0">&nbsp;</td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">
              <tr>
                <td align="left" style="${SANS}">
                  <div style="font-size:9px;letter-spacing:1px;color:${gold};font-weight:700">INVESTED</div>
                  <div style="font-size:14px;font-weight:700;color:#ffffff">${formatCents(s.investedCents)}</div>
                </td>
                <td align="right" style="${SANS}">
                  <div style="font-size:9px;letter-spacing:1px;color:#c9d3e0;font-weight:700">SPENDABLE</div>
                  <div style="font-size:14px;font-weight:700;color:#ffffff">${formatCents(s.spendableCents)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}

/** The two value infographics (bordered cells, Outlook-safe). */
function infographics(s: ReturnType<typeof computeGiftSummary>): string {
  const box = (label: string, value: string, sub: string) => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER_DIM}">
              <tr>
                <td align="center" style="padding:14px 8px">
                  <div style="font-size:9px;letter-spacing:1px;color:#c9d3e0;font-weight:700;${SANS}">${label}</div>
                  <div style="${SERIF};font-size:24px;font-weight:700;color:#ffffff;margin:6px 0">${value}</div>
                  <div style="font-size:9px;color:#8994a6;${SANS}">${sub}</div>
                </td>
              </tr>
            </table>`;
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0">
        <tr>
          <td width="50%" valign="top" style="padding-right:5px">${box("TRUE GIFT VALUE", formatDollars(s.trueGiftValueCents), "to spend + Trump Account by 18")}</td>
          <td width="50%" valign="top" style="padding-left:5px">${box("IF KEPT TO RETIREMENT (65)", formatDollars(s.projectedAt65Cents), RETURN_LABEL)}</td>
        </tr>
      </table>`;
}

export interface ClaimEmailInput {
  recipientName?: string;
  /** Gifter's display name — shown as the sender ("From …"). */
  fromName?: string;
  /** VERIFIED gifts show the name-match notice. */
  verificationMode?: "OPEN" | "VERIFIED";
  message?: string;
  amountCents: number;
  trumpPercent: number;
  /** Selected spendable-card brand, e.g. "Amazon" / "Visa Gift Card". */
  brandName?: string;
  claimUrl: string;
}

/** The gift-reveal email: the built card, projected value, primer, claim CTA. */
export function buildClaimEmailHtml(input: ClaimEmailInput): string {
  const s = computeGiftSummary(input.amountCents, input.trumpPercent);
  const greeting = input.recipientName ? `Hi ${esc(input.recipientName)},` : "Hi,";
  const facts = TRUMP_ACCOUNT_FACTS.map(
    (f) =>
      `<tr><td valign="top" style="color:${gold};padding:3px 8px 3px 0;font-size:13px;line-height:1.4">&bull;</td>` +
      `<td valign="top" style="color:#c9d3e0;font-size:13px;line-height:1.4;padding-bottom:3px">${esc(f)}</td></tr>`,
  ).join("");

  return shell(`
      ${lockup()}
      <div style="${SERIF};color:${gold};font-size:24px;font-weight:700;margin:0 0 6px">You&rsquo;ve received a gift &#127873;</div>
      <p style="color:#c9d3e0;font-size:14px;line-height:1.5;margin:0 0 22px;${SANS}">${greeting} ${
        input.fromName ? `<strong style="color:#ffffff">${esc(input.fromName)}</strong>` : "someone"
      } sent you a gift toward your future &mdash; cash to spend today, plus an investment in a tax-advantaged Trump Account.</p>
      ${cardBlock(input, s)}
      ${
        input.recipientName && input.verificationMode !== "OPEN"
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1710" style="background-color:#1a1710;border:1px solid ${gold};margin-top:10px"><tr><td style="padding:12px 14px"><div style="color:${gold};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;${SANS}">Name-verified gift</div><div style="color:#d9c9a6;font-size:12px;line-height:1.5;${SANS}">${esc(verifiedNotice(input.recipientName))}</div></td></tr></table>`
          : ""
      }
      ${
        input.message
          ? `<p style="color:#aeb8c7;font-style:italic;font-size:13px;text-align:center;margin:16px 8px;${SANS}">&ldquo;${esc(input.message)}&rdquo;</p>`
          : ""
      }
      ${infographics(s)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:14px 0 8px">${button(
        input.claimUrl,
        "Claim Your Gift",
      )}</td></tr></table>
      <p style="color:#8994a6;font-size:11px;text-align:center;margin:0 0 8px;${SANS}">or visit ${input.claimUrl}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid ${BORDER_DIM}">
        <tr><td style="padding-top:20px">
          <div style="color:${gold};font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;${SANS}">What is a Trump Account?</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${SANS}">${facts}</table>
        </td></tr>
      </table>
      <p style="color:#6b7688;font-size:10px;line-height:1.4;margin:22px 0 0;${SANS}">${PROJECTION_DISCLAIMER}</p>`);
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

/**
 * Send the gift-reveal / claim email via Brevo (no amounts in the subject, §8).
 * The certificate PDF (with the claim QR) is attached when provided.
 */
export async function sendClaimEmail(to: string, input: ClaimEmailInput, pdf?: Uint8Array): Promise<void> {
  await sendBrevoEmail({
    to,
    subject: "You've received a gift",
    html: buildClaimEmailHtml(input),
    text: textVersion(input),
    attachments: pdf ? [{ name: "trump-account-gift.pdf", content: Buffer.from(pdf).toString("base64") }] : undefined,
  });
}

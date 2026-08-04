import { PDFDocument, StandardFonts, rgb, PDFFont, RGB } from "pdf-lib";
import QRCode from "qrcode";
import { formatCents } from "../domain/money";
import {
  computeGiftSummary,
  formatDollars,
  TRUMP_ACCOUNT_FACTS,
  PROJECTION_DISCLAIMER,
  RETURN_LABEL,
  verifiedNotice,
} from "./gift-summary";
import { BRAND_ART } from "./brand-art";

/** Map a display brand name to its bundled art key, or null if unknown. */
function brandArtKey(brandName?: string): string | null {
  if (!brandName) return null;
  const n = brandName.toLowerCase();
  for (const key of ["amazon", "visa", "starbucks", "walmart"]) {
    if (n.includes(key)) return key;
  }
  return null;
}

export interface CertificateInput {
  recipientName?: string;
  /** Gifter's display name — shown as "From …" when present. */
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

const hx = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const NAVY = hx("#060D18");
const GOLD = hx("#C79E4D");
const WHITE = rgb(1, 1, 1);
const INK = hx("#1A1F2B");
const MUTED = rgb(0.42, 0.45, 0.5);

const PAGE_W = 612;
const PAGE_H = 792;

/** Strip characters the standard (WinAnsi) fonts can't encode. */
const safe = (t: string) => t.replace(/[^\x20-\x7E]/g, "");

/**
 * Generate a printable gift-certificate PDF: the built gift card, the projected
 * value (True Gift Value + retirement), a short "what is a Trump Account"
 * primer, and a QR/link to claim. Illustration figures mirror the configurator.
 */
export async function generateCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const s = computeGiftSummary(input.amountCents, input.trumpPercent);
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);

  const w = (t: string, size: number, f: PDFFont) => f.widthOfTextAtSize(t, size);
  const at = (t: string, x: number, y: number, size: number, f: PDFFont = helv, color: RGB = INK) =>
    page.drawText(t, { x, y, size, font: f, color });
  const center = (t: string, cx: number, y: number, size: number, f: PDFFont = helv, color: RGB = INK) =>
    page.drawText(t, { x: cx - w(t, size, f) / 2, y, size, font: f, color });
  const rightOf = (t: string, xr: number, y: number, size: number, f: PDFFont = helv, color: RGB = INK) =>
    page.drawText(t, { x: xr - w(t, size, f), y, size, font: f, color });

  const MID = PAGE_W / 2;

  // Outer frame
  page.drawRectangle({ x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48, borderColor: hx("#DCCB9E"), borderWidth: 1.5 });

  // Title + gifter
  const rname = input.recipientName ? safe(input.recipientName) : "";
  center("A GIFT TOWARD", MID, 744, 11, bold, GOLD);
  center(rname ? `${rname.toUpperCase()}'S FUTURE` : "YOUR FUTURE", MID, 720, 23, serif, INK);
  if (input.fromName) center(`from ${safe(input.fromName)}`, MID, 706, 10, italic, MUTED);

  // ---------- The gift card ----------
  const cardW = 388, cardH = 202;
  const cardX = (PAGE_W - cardW) / 2;
  const cardY = 496; // bottom edge; spans 496..698
  page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: NAVY, borderColor: GOLD, borderWidth: 1 });
  // Brand art faded into the card's top-right corner (matches the site card).
  const artKey = brandArtKey(input.brandName);
  if (artKey) {
    const art = await doc.embedPng(Buffer.from(BRAND_ART[artKey], "base64"));
    const artSize = 132;
    page.drawImage(art, { x: cardX + cardW - artSize, y: cardY + cardH - artSize, width: artSize, height: artSize });
  }
  const px = cardX + 26;
  // T box + lockup
  const tBox = 30, tY = cardY + cardH - 26 - tBox;
  page.drawRectangle({ x: px, y: tY, width: tBox, height: tBox, borderColor: GOLD, borderWidth: 1.5 });
  at("T", px + (tBox - w("T", 18, serif)) / 2, tY + 8, 18, serif, GOLD);
  const cardLabel = input.brandName ? safe(input.brandName).toUpperCase() : "GIFT CARD";
  at("TRUMP ACCOUNT", px + tBox + 12, tY + tBox - 14, 12, bold, WHITE);
  at(cardLabel, px + tBox + 12, tY + 2, 8, bold, GOLD);
  // amount
  at(formatDollars(input.amountCents), px, cardY + 96, 32, serif, WHITE);
  // split bar
  const barW = cardW - 52, barH = 9, barY = cardY + 58;
  const goldW = (barW * s.trumpPercent) / 100;
  page.drawRectangle({ x: px, y: barY, width: goldW, height: barH, color: GOLD });
  page.drawRectangle({ x: px + goldW, y: barY, width: barW - goldW, height: barH, color: WHITE });
  // bar labels
  at("INVESTED", px, cardY + 34, 7, bold, GOLD);
  at(formatCents(s.investedCents), px, cardY + 17, 12, bold, WHITE);
  rightOf("SPENDABLE", px + barW, cardY + 34, 7, bold, rgb(0.8, 0.83, 0.88));
  rightOf(formatCents(s.spendableCents), px + barW, cardY + 17, 12, bold, WHITE);

  // ---------- Message ----------
  if (input.message) {
    const raw = safe(input.message);
    const msg = raw.length > 150 ? `${raw.slice(0, 147)}...` : raw;
    center(`"${msg}"`, MID, 472, 11, italic, MUTED);
  }

  // ---------- Infographics ----------
  const infoY = 380, infoH = 80, gap = 18, frameM = 48;
  const infoW = (PAGE_W - frameM * 2 - gap) / 2;
  const lX = frameM, rX = frameM + infoW + gap;
  page.drawRectangle({ x: lX, y: infoY, width: infoW, height: infoH, borderColor: hx("#E4DBC2"), borderWidth: 1 });
  page.drawRectangle({ x: rX, y: infoY, width: infoW, height: infoH, borderColor: hx("#E4DBC2"), borderWidth: 1 });
  const lC = lX + infoW / 2, rC = rX + infoW / 2;
  center("TRUE GIFT VALUE", lC, infoY + infoH - 17, 8.5, bold, MUTED);
  center(formatDollars(s.trueGiftValueCents), lC, infoY + infoH - 46, 24, serif, INK);
  center("cash to spend + Trump Account by 18", lC, infoY + 11, 7, helv, MUTED);
  center("IF KEPT TO RETIREMENT (AGE 65)", rC, infoY + infoH - 17, 8.5, bold, MUTED);
  center(formatDollars(s.projectedAt65Cents), rC, infoY + infoH - 46, 24, serif, INK);
  center(RETURN_LABEL, rC, infoY + 11, 7, helv, MUTED);

  // ---------- Claim QR (centered) ----------
  const qrPng = await QRCode.toBuffer(input.claimUrl, { margin: 1, width: 300, type: "png" });
  const qr = await doc.embedPng(qrPng);
  const qrSize = 120, qrY = 246;
  page.drawImage(qr, { x: MID - qrSize / 2, y: qrY, width: qrSize, height: qrSize });
  center("SCAN TO CLAIM YOUR GIFT", MID, qrY - 16, 9, bold, INK);
  let urlSize = 8;
  while (w(input.claimUrl, urlSize, helv) > PAGE_W - 120 && urlSize > 5) urlSize -= 0.5;
  center(input.claimUrl, MID, qrY - 29, urlSize, helv, hx("#1D4ED8"));

  // ---------- What is a Trump Account (beneath the QR) ----------
  center("WHAT IS A TRUMP ACCOUNT?", MID, 190, 12, bold, INK);
  let by = 170;
  const bulletX = 132;
  for (const fact of TRUMP_ACCOUNT_FACTS) {
    page.drawRectangle({ x: bulletX, y: by + 2, width: 3, height: 3, color: GOLD });
    at(safe(fact), bulletX + 11, by, 8.5, helv, INK);
    by -= 16;
  }

  // ---------- Verified-gift notice (name must match) ----------
  if (input.recipientName && input.verificationMode !== "OPEN") {
    const notice = safe(verifiedNotice(input.recipientName));
    const words = notice.split(" ");
    const maxW = 470;
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const t = line ? `${line} ${word}` : word;
      if (w(t, 8, helv) > maxW) {
        lines.push(line);
        line = word;
      } else line = t;
    }
    if (line) lines.push(line);
    // Light amber box around the notice.
    const boxTop = 96,
      boxH = lines.length * 11 + 12;
    page.drawRectangle({ x: 40, y: boxTop - boxH, width: PAGE_W - 80, height: boxH, borderColor: GOLD, borderWidth: 0.75 });
    lines.forEach((ln, i) => center(ln, MID, boxTop - 14 - i * 11, 8, helv, hx("#7A5A12")));
  }

  // ---------- Footer disclaimer ----------
  center(PROJECTION_DISCLAIMER, MID, 34, 6.5, helv, MUTED);

  return doc.save();
}

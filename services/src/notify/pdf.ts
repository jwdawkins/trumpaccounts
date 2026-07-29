import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { formatCents } from "../domain/money";

export interface CertificateInput {
  recipientName?: string;
  message?: string;
  amountCents: number;
  claimUrl: string;
}

/**
 * Generate a printable gift-certificate PDF for SELF delivery (D2):
 * amount, optional message, and a QR of the claim URL.
 */
export async function generateCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.42, 0.45, 0.5);

  const center = (text: string, y: number, size: number, font = helv, color = ink) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (612 - w) / 2, y, size, font, color });
  };

  page.drawRectangle({ x: 36, y: 36, width: 540, height: 720, borderColor: rgb(0.8, 0.83, 0.88), borderWidth: 1.5 });
  center("A Gift For Your Future", 690, 26, bold);
  center(input.recipientName ? `To ${input.recipientName}` : "To you", 655, 14, helv, muted);
  center(formatCents(input.amountCents), 590, 44, bold, rgb(0.15, 0.39, 0.92));
  center("toward a Trump Account + gift card", 560, 12, helv, muted);

  if (input.message) {
    const msg = input.message.length > 180 ? `${input.message.slice(0, 177)}…` : input.message;
    center(`"${msg}"`, 515, 12, helv, ink);
  }

  const qrPng = await QRCode.toBuffer(input.claimUrl, { margin: 1, width: 220, type: "png" });
  const qr = await doc.embedPng(qrPng);
  page.drawImage(qr, { x: (612 - 200) / 2, y: 250, width: 200, height: 200 });

  center("Scan to claim your gift", 225, 12, bold);
  center("or visit:", 205, 10, helv, muted);
  center(input.claimUrl, 188, 9, helv, rgb(0.15, 0.39, 0.92));

  return doc.save();
}

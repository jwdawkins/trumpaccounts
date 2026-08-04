import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

/** Merge per-card certificate PDFs into one document (one card per page-set). */
export async function mergeCertificates(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of pdfs) {
    const src = await PDFDocument.load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** Bundle per-card certificate PDFs into a single zip. */
export async function zipCertificates(entries: { name: string; pdf: Uint8Array }[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.pdf);
  return zip.generateAsync({ type: "uint8array" });
}

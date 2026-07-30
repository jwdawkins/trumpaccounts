import jsQR from "jsqr";
import { BrowserQRCodeReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
async function tryBarcodeDetector(img: HTMLImageElement): Promise<string | null> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Ctor) return null;
  try {
    const codes = await new Ctor({ formats: ["qr_code"] }).detect(img);
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

function zxingReader(): BrowserQRCodeReader {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  return new BrowserQRCodeReader(hints);
}
async function zxingFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    return (await zxingReader().decodeFromCanvas(canvas)).getText() || null;
  } catch {
    return null;
  }
}
function jsqrFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}
async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  return jsqrFromCanvas(canvas) ?? (await zxingFromCanvas(canvas));
}

/** Grayscale + Gaussian-blur an image into a canvas scaled to `targetWidth`. */
function grayBlur(img: HTMLImageElement, targetWidth: number, blurPx: number): HTMLCanvasElement {
  const scale = Math.min(1, targetWidth / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = `grayscale(1) blur(${blurPx}px)`;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  return canvas;
}

/** Threshold a grayscale canvas to pure black/white in place-ish (new canvas). */
function threshold(src: HTMLCanvasElement, t: number): HTMLCanvasElement {
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const imgData = sctx.getImageData(0, 0, src.width, src.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < t ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  out.getContext("2d")!.putImageData(imgData, 0, 0);
  return out;
}

/**
 * Decode a QR from an uploaded image. Strategy, cheapest first:
 *  1. native BarcodeDetector (if present)
 *  2. crisp raw scan (fast path for plain QRs)
 *  3. blur + threshold matrix — a morphological "close" that merges dotted /
 *     stylized modules (logo-in-center, colored finders) into solid squares.
 *     This recipe (resize ~500-700px + blur σ2-3 + threshold) was validated
 *     offline against real branded Trump Account QR art.
 * Returns the payload, or null if nothing decodes. Throws only if the image
 * itself can't be loaded (e.g. HEIC).
 */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    const native = await tryBarcodeDetector(img);
    if (native) return native;

    // Crisp raw pass (plain QRs).
    const raw = grayBlur(img, Math.min(img.naturalWidth, 1600), 0);
    const crisp = await decodeCanvas(raw);
    if (crisp) return crisp;

    // Stylized pass: merge dots via blur, then threshold.
    for (const width of [700, 500, 600, 400]) {
      for (const blurPx of [2, 3]) {
        const base = grayBlur(img, width, blurPx);
        for (const t of [190, 160, 210]) {
          const hit = await decodeCanvas(threshold(base, t));
          if (hit) return hit;
        }
      }
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

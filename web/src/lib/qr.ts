import jsQR from "jsqr";
import { BrowserQRCodeReader } from "@zxing/browser";

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

/** Native BarcodeDetector (some Chromium builds) — try first when present. */
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

/** ZXing — robust at locating QRs within photos/screenshots. */
async function tryZxing(img: HTMLImageElement): Promise<string | null> {
  try {
    const result = await new BrowserQRCodeReader().decodeFromImageElement(img);
    return result.getText() || null;
  } catch {
    return null;
  }
}

/** jsQR last-resort, crisp downscales (no smoothing), inversion attempts. */
function tryJsQr(img: HTMLImageElement): string | null {
  const biggest = Math.max(img.naturalWidth, img.naturalHeight);
  for (const maxDim of [biggest, 1600, 1024, 700, 500]) {
    const scale = Math.min(1, maxDim / biggest);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const hit = jsQR(data, w, h, { inversionAttempts: "attemptBoth" })?.data;
    if (hit) return hit;
  }
  return null;
}

/**
 * Decode a QR code from an uploaded image, entirely in the browser, using the
 * best available decoder. Returns the opaque payload, or null if no QR was
 * found. Throws only when the image itself can't be loaded (e.g. HEIC).
 */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return (await tryBarcodeDetector(img)) ?? (await tryZxing(img)) ?? tryJsQr(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

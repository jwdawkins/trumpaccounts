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

function scaledCanvas(img: HTMLImageElement, maxDim: number, smooth = false): HTMLCanvasElement {
  const biggest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = Math.min(1, maxDim / biggest);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = smooth;
  if (smooth) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Binarize: any pixel clearly darker than a near-white background becomes black,
 * everything else white. This normalizes stylized QRs — colored (e.g. gold)
 * finder patterns and center logos all collapse to black — which decoders read
 * far better than the original colored/dotted art.
 */
function binarize(src: HTMLCanvasElement, threshold = 200): HTMLCanvasElement {
  const ctx = src.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  out.getContext("2d")!.putImageData(img, 0, 0);
  return out;
}

function jsqrOnCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/**
 * Decode a QR from an uploaded image using several strategies, in order of
 * cost: native detector, then ZXing/jsQR on the raw image, then the same on a
 * binarized image (which rescues stylized/branded QRs like logo-in-center).
 * Returns the payload, or null if nothing decodes. Throws only if the image
 * can't be loaded at all (e.g. HEIC).
 */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    const native = await tryBarcodeDetector(img);
    if (native) return native;

    const biggest = Math.max(img.naturalWidth, img.naturalHeight);

    // Pass 1: crisp scales, raw then binarized (handles normal QRs).
    for (const maxDim of [biggest, 1400, 1000, 700]) {
      const canvas = scaledCanvas(img, maxDim, false);
      const raw = (await zxingFromCanvas(canvas)) ?? jsqrOnCanvas(canvas);
      if (raw) return raw;
      const bin = binarize(canvas);
      const fromBin = (await zxingFromCanvas(bin)) ?? jsqrOnCanvas(bin);
      if (fromBin) return fromBin;
    }

    // Pass 2: smoothed downscales + binarize — merges dotted/stylized modules
    // into solid ones so branded QRs (dots, logo, colored finders) decode.
    for (const maxDim of [700, 550, 450, 360, 280]) {
      const smoothed = scaledCanvas(img, maxDim, true);
      const bin = binarize(smoothed);
      const hit = (await zxingFromCanvas(bin)) ?? jsqrOnCanvas(bin) ?? (await zxingFromCanvas(smoothed));
      if (hit) return hit;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

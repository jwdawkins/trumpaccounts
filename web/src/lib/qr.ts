import jsQR from "jsqr";
import { readBarcodesFromImageData, prepareZXingModule } from "zxing-wasm/reader";

// Serve the WASM locally (bundled in /public) rather than from a CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path,
  },
});

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

/** Render the image to a target width (up- or down-scaling), grayscale + blur. */
function render(img: HTMLImageElement, targetWidth: number, blurPx: number): ImageData {
  const scale = targetWidth / img.naturalWidth;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = blurPx > 0 ? `grayscale(1) blur(${blurPx}px)` : "grayscale(1)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  return ctx.getImageData(0, 0, w, h);
}

/** Threshold an ImageData to pure black/white in place. */
function threshold(imageData: ImageData, t: number): ImageData {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < t ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return imageData;
}

async function decodeImageData(imageData: ImageData): Promise<string | null> {
  try {
    const results = await readBarcodesFromImageData(imageData, {
      tryHarder: true,
      tryInvert: true,
      formats: ["QRCode"],
    });
    const hit = results.find((r) => r.text);
    if (hit?.text) return hit.text;
  } catch {
    /* fall through to jsQR */
  }
  try {
    return jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    })?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Preprocessing recipes, validated offline against real Trump Account QR art:
 *  - upscale (raw / light threshold): rescues LOW-RES screenshots
 *  - downscale + blur + threshold: rescues HIGH-RES stylized QRs (dotted
 *    modules, center logo, colored finders) by merging dots into solid modules
 * Each recipe is fed to the ZXing WASM engine, then jsQR.
 */
const RECIPES: Array<{ width: number; blur: number; threshold?: number }> = [
  { width: 1200, blur: 0 },
  { width: 1000, blur: 0 },
  { width: 1200, blur: 0, threshold: 170 },
  { width: 600, blur: 2, threshold: 190 },
  { width: 700, blur: 2, threshold: 160 },
  { width: 500, blur: 3, threshold: 190 },
  { width: 600, blur: 2, threshold: 210 },
];

/**
 * Decode a QR from an uploaded image. Returns the payload, or null if nothing
 * decodes. Throws only if the image itself can't be loaded (e.g. HEIC).
 */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    const native = await tryBarcodeDetector(img);
    if (native) return native;

    for (const r of RECIPES) {
      const imageData = render(img, r.width, r.blur);
      const processed = r.threshold != null ? threshold(imageData, r.threshold) : imageData;
      const hit = await decodeImageData(processed);
      if (hit) return hit;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

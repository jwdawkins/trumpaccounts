import jsQR from "jsqr";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Decode a QR code from an uploaded image, entirely in the browser (canvas +
 * jsQR). Returns the opaque payload string, or null if no QR was found.
 */
export async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(data, width, height)?.data ?? null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

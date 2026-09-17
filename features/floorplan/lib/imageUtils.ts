export type LoadedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Longest side (in px) we keep when sending the floorplan to the model. */
export const MAX_IMAGE_SIZE = 1600;

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file could not be read as an image."));
    };
    img.src = url;
  });
}

/**
 * Target size for an image scaled down to fit inside `maxSize` on its longest
 * side, preserving aspect ratio. Images already within the limit are left alone
 * (the scale is clamped to 1, so this never upscales), and both edges stay at
 * least 1px so a very thin image cannot round down to a zero-sized canvas.
 *
 * Split out from `readAndDownscaleImage` so the arithmetic can be unit tested
 * without a DOM.
 */
export function fitWithin(
  naturalWidth: number,
  naturalHeight: number,
  maxSize: number = MAX_IMAGE_SIZE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSize / Math.max(naturalWidth, naturalHeight));
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

/**
 * Reads an image file and downsizes it so its longest side is at most `maxSize`.
 * Smaller images keep tokens and request payload under control without hurting
 * the model's ability to read a floorplan.
 */
export async function readAndDownscaleImage(
  file: File,
  maxSize: number = MAX_IMAGE_SIZE,
): Promise<LoadedImage> {
  const img = await loadImageElement(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxSize);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  // Floorplans are usually drawn on transparent or white backgrounds; a white
  // fill keeps them readable when exporting to JPEG (which has no alpha channel).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // PNG keeps thin lines crisp; anything else (photos, scans) is fine as JPEG.
  const dataUrl =
    file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);

  return { dataUrl, width, height };
}

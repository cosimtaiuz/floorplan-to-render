import type { CameraMarker } from "@/features/floorplan/types";

/** ~6 MB of base64 covers a 1600px image comfortably while blocking abuse. */
export const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000;
export const MAX_PROMPT_LENGTH = 4_000;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

/**
 * Validates a camera marker coming from the client.
 * Returns `undefined` when absent, `null` when malformed, the marker otherwise.
 */
export function parseCamera(value: unknown): CameraMarker | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") return null;
  const { x, y, angleDeg } = value as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(angleDeg)) return null;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y, angleDeg: ((angleDeg % 360) + 360) % 360 };
}

export type DecodedDataUrl = { mimeType: string; buffer: Buffer };

/** Splits a `data:image/...;base64,...` URL into its MIME type and raw bytes. */
export function decodeImageDataUrl(dataUrl: string): DecodedDataUrl | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

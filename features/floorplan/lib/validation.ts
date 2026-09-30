import {
  CLAUDE_EFFORTS,
  REASONING_EFFORTS,
  RENDER_QUALITIES,
  type CameraMarker,
  type ClaudeEffort,
  type OutputSize,
  type ReasoningEffort,
  type RenderQuality,
} from "@/features/floorplan/types";

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

/** Returns the value when it is on the scale, `undefined` otherwise (absent or unknown). */
function parseOnScale<T extends string>(value: unknown, scale: readonly T[]): T | undefined {
  return typeof value === "string" && (scale as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** Reasoning effort asked for by the client. Anything unknown is treated as "not asked". */
export function parseReasoningEffort(value: unknown): ReasoningEffort | undefined {
  return parseOnScale(value, REASONING_EFFORTS);
}

/** Claude effort asked for by the client. Anything unknown is treated as "not asked". */
export function parseClaudeEffort(value: unknown): ClaudeEffort | undefined {
  return parseOnScale(value, CLAUDE_EFFORTS);
}

/** Render quality asked for by the client. Anything unknown is treated as "not asked". */
export function parseRenderQuality(value: unknown): RenderQuality | undefined {
  return parseOnScale(value, RENDER_QUALITIES);
}

/**
 * Explicit render size coming from the client. Returns `undefined` when absent
 * (the render then matches the 3D view), `null` when malformed, the size otherwise.
 *
 * Only the shape is checked here: the pixel constraints of the image API are
 * applied by `resolveOutputSize`, which a client value must never bypass.
 */
export function parseOutputSize(value: unknown): OutputSize | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") return null;
  const { width, height } = value as Record<string, unknown>;
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Settles what a request actually gets on a cheapest-first scale.
 *
 * `chosen` comes from the browser, so it only ever lowers or raises the setting
 * within what the deployment allows: `ceiling` is the operator's cap (an
 * environment variable). Unset means the whole scale is available; a value on
 * the scale caps the request there; anything else caps it at `fallback`, so a
 * typo in the environment cannot widen what a visitor is able to spend.
 */
export function capOnScale<T extends string>(
  scale: readonly T[],
  chosen: T | undefined,
  fallback: T,
  ceiling: string | undefined,
): T {
  const fallbackIndex = scale.indexOf(fallback);
  const indexOf = (value: string | undefined, whenMissing: number) => {
    const index = value === undefined ? -1 : scale.indexOf(value as T);
    return index === -1 ? whenMissing : index;
  };
  const ceilingIndex = ceiling === undefined ? scale.length - 1 : indexOf(ceiling, fallbackIndex);
  return scale[Math.min(indexOf(chosen, fallbackIndex), ceilingIndex)];
}

export type DecodedDataUrl = { mimeType: string; buffer: Buffer };

/** Splits a `data:image/...;base64,...` URL into its MIME type and raw bytes. */
export function decodeImageDataUrl(dataUrl: string): DecodedDataUrl | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

/**
 * Output resolution for the render step. Kept out of the route so it can be
 * unit tested: it is pure arithmetic with constraints that are easy to break.
 */

import type { OutputSize } from "@/features/floorplan/types";

/** Output long edge. Keeps latency/cost reasonable while matching the screenshot aspect. */
export const OUTPUT_LONG_EDGE = 1536;
/** Image model constraints: edges divisible by 16, aspect ratio between 1:3 and 3:1. */
export const SIZE_STEP = 16;
export const MAX_ASPECT = 3;
export const FALLBACK_SIZE = "1536x1024";
/**
 * Envelope a user-picked size is squeezed into. The model accepts more than
 * this, but pixels are what the render costs, so an explicit size stays inside
 * the same budget as the automatic one.
 */
export const MIN_OUTPUT_EDGE = 256;
export const MAX_OUTPUT_EDGE = OUTPUT_LONG_EDGE;

function roundToStep(value: number): number {
  return Math.max(SIZE_STEP, Math.round(value / SIZE_STEP) * SIZE_STEP);
}

/** Rounds up, so a short edge derived from the aspect limit never lands just under it. */
function ceilToStep(value: number): number {
  return Math.max(SIZE_STEP, Math.ceil(value / SIZE_STEP) * SIZE_STEP);
}

/**
 * Forces a requested size into what the API accepts: both edges divisible by
 * SIZE_STEP, inside the edge envelope, and an aspect ratio no wider than
 * MAX_ASPECT (the short edge is raised rather than the long edge cut, so the
 * requested framing is kept as far as the limit allows).
 */
function normalizeRequestedSize(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return FALLBACK_SIZE;
  const clamp = (edge: number) =>
    Math.min(MAX_OUTPUT_EDGE, Math.max(MIN_OUTPUT_EDGE, roundToStep(edge)));
  const landscape = width >= height;
  const clamped = [clamp(width), clamp(height)];
  const longEdge = Math.max(...clamped);
  const shortEdge = Math.max(Math.min(...clamped), ceilToStep(longEdge / MAX_ASPECT));
  return landscape ? `${longEdge}x${shortEdge}` : `${shortEdge}x${longEdge}`;
}

/**
 * Picks an output resolution with the same aspect ratio as the screenshot so the
 * model does not have to crop or stretch the view. The long edge is fixed to
 * OUTPUT_LONG_EDGE and the short edge is clamped to keep the ratio within 3:1.
 *
 * A `requested` size (chosen in the UI) takes over from the screenshot aspect,
 * but goes through the same constraints: a size the API would reject is a render
 * that fails after the user has already waited for it.
 *
 * Non-finite or non-positive inputs fall back to a safe landscape size rather
 * than producing a size string the API would reject.
 */
export function resolveOutputSize(
  width: number,
  height: number,
  requested?: OutputSize | null,
): string {
  if (requested) return normalizeRequestedSize(requested.width, requested.height);
  if (!(width > 0) || !(height > 0)) return FALLBACK_SIZE;
  const landscape = width >= height;
  const ratio = Math.min(MAX_ASPECT, Math.max(width, height) / Math.min(width, height));
  const longEdge = OUTPUT_LONG_EDGE;
  const shortEdge = roundToStep(longEdge / ratio);
  return landscape ? `${longEdge}x${shortEdge}` : `${shortEdge}x${longEdge}`;
}

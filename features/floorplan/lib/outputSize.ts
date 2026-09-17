/**
 * Output resolution for the render step. Kept out of the route so it can be
 * unit tested: it is pure arithmetic with constraints that are easy to break.
 */

/** Output long edge. Keeps latency/cost reasonable while matching the screenshot aspect. */
export const OUTPUT_LONG_EDGE = 1536;
/** Image model constraints: edges divisible by 16, aspect ratio between 1:3 and 3:1. */
export const SIZE_STEP = 16;
export const MAX_ASPECT = 3;
export const FALLBACK_SIZE = "1536x1024";

function roundToStep(value: number): number {
  return Math.max(SIZE_STEP, Math.round(value / SIZE_STEP) * SIZE_STEP);
}

/**
 * Picks an output resolution with the same aspect ratio as the screenshot so the
 * model does not have to crop or stretch the view. The long edge is fixed to
 * OUTPUT_LONG_EDGE and the short edge is clamped to keep the ratio within 3:1.
 *
 * Non-finite or non-positive inputs fall back to a safe landscape size rather
 * than producing a size string the API would reject.
 */
export function resolveOutputSize(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return FALLBACK_SIZE;
  const landscape = width >= height;
  const ratio = Math.min(MAX_ASPECT, Math.max(width, height) / Math.min(width, height));
  const longEdge = OUTPUT_LONG_EDGE;
  const shortEdge = roundToStep(longEdge / ratio);
  return landscape ? `${longEdge}x${shortEdge}` : `${shortEdge}x${longEdge}`;
}

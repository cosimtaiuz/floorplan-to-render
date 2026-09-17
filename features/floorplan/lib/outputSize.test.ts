import { describe, expect, it } from "vitest";
import {
  FALLBACK_SIZE,
  MAX_ASPECT,
  OUTPUT_LONG_EDGE,
  SIZE_STEP,
  resolveOutputSize,
} from "./outputSize";

function parse(size: string): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

describe("resolveOutputSize", () => {
  it("puts the long edge on the wide side for a landscape screenshot", () => {
    const { width, height } = parse(resolveOutputSize(1920, 1080));
    expect(width).toBe(OUTPUT_LONG_EDGE);
    expect(height).toBeLessThan(width);
  });

  it("flips the orientation for a portrait screenshot", () => {
    const { width, height } = parse(resolveOutputSize(1080, 1920));
    expect(height).toBe(OUTPUT_LONG_EDGE);
    expect(width).toBeLessThan(height);
  });

  it("treats an exact square as landscape", () => {
    expect(resolveOutputSize(800, 800)).toBe(`${OUTPUT_LONG_EDGE}x${OUTPUT_LONG_EDGE}`);
  });

  // The API rejects sizes whose edges are not multiples of 16, so this is the
  // property that actually keeps the render step working.
  it("always returns edges divisible by the size step", () => {
    const viewports = [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [1280, 1024],
      [390, 844],
      [820, 1180],
      [3440, 1440],
      [1001, 999],
      [17, 5],
    ] as const;

    for (const [w, h] of viewports) {
      const { width, height } = parse(resolveOutputSize(w, h));
      expect(width % SIZE_STEP, `width for ${w}x${h}`).toBe(0);
      expect(height % SIZE_STEP, `height for ${w}x${h}`).toBe(0);
    }
  });

  it("clamps an extreme aspect ratio to the API's 3:1 limit", () => {
    // 10:1 input would otherwise ask for a size the API refuses.
    const { width, height } = parse(resolveOutputSize(5000, 500));
    expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(MAX_ASPECT);
  });

  it("keeps every result within the aspect limit, in both orientations", () => {
    for (const [w, h] of [
      [5000, 500],
      [500, 5000],
      [10000, 1],
      [1, 10000],
    ] as const) {
      const { width, height } = parse(resolveOutputSize(w, h));
      const ratio = Math.max(width, height) / Math.min(width, height);
      expect(ratio, `ratio for ${w}x${h}`).toBeLessThanOrEqual(MAX_ASPECT);
    }
  });

  it("never returns a zero or negative edge", () => {
    for (const [w, h] of [
      [1, 10000],
      [10000, 1],
      [1, 1],
    ] as const) {
      const { width, height } = parse(resolveOutputSize(w, h));
      expect(width, `width for ${w}x${h}`).toBeGreaterThan(0);
      expect(height, `height for ${w}x${h}`).toBeGreaterThan(0);
    }
  });

  it("falls back instead of emitting a size the API would reject", () => {
    expect(resolveOutputSize(0, 100)).toBe(FALLBACK_SIZE);
    expect(resolveOutputSize(100, 0)).toBe(FALLBACK_SIZE);
    expect(resolveOutputSize(-100, 100)).toBe(FALLBACK_SIZE);
    expect(resolveOutputSize(NaN, 100)).toBe(FALLBACK_SIZE);
  });

  /**
   * Infinity passes the `> 0` guard, so it reaches the ratio clamp and comes out
   * as a valid 3:1 size rather than the fallback. That is fine: the route rejects
   * non-finite dimensions with `isFiniteNumber` long before this is called. Pinned
   * so the behaviour is deliberate rather than accidental.
   */
  it("clamps a non-finite dimension to a valid size rather than crashing", () => {
    const { width, height } = parse(resolveOutputSize(Infinity, 100));
    expect(width).toBe(OUTPUT_LONG_EDGE);
    expect(width % SIZE_STEP).toBe(0);
    expect(height % SIZE_STEP).toBe(0);
    expect(width / height).toBeLessThanOrEqual(MAX_ASPECT);
  });

  it("preserves the screenshot aspect closely for common viewports", () => {
    const { width, height } = parse(resolveOutputSize(1600, 900));
    // 16:9 within one 16px step of rounding.
    expect(Math.abs(width / height - 1600 / 900)).toBeLessThan(0.02);
  });
});

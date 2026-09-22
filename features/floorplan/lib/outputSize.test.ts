import { describe, expect, it } from "vitest";
import {
  FALLBACK_SIZE,
  MAX_ASPECT,
  MAX_OUTPUT_EDGE,
  MIN_OUTPUT_EDGE,
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

/**
 * A requested size comes from the browser, so it is untrusted input that decides
 * what a render costs and whether the API accepts the call at all. These are the
 * same constraints as above, applied to a size nobody validated for us.
 */
describe("resolveOutputSize with a requested size", () => {
  it("uses the requested size instead of the screenshot aspect", () => {
    expect(resolveOutputSize(1920, 1080, { width: 1024, height: 1024 })).toBe("1024x1024");
    expect(resolveOutputSize(1920, 1080, { width: 1024, height: 1536 })).toBe("1024x1536");
  });

  it("keeps the standard sizes of the image API untouched", () => {
    for (const size of ["1024x1024", "1536x1024", "1024x1536"] as const) {
      const { width, height } = parse(size);
      expect(resolveOutputSize(1920, 1080, { width, height })).toBe(size);
    }
  });

  it("snaps edges that are not multiples of the size step", () => {
    const { width, height } = parse(resolveOutputSize(1920, 1080, { width: 1000, height: 777 }));
    expect(width % SIZE_STEP).toBe(0);
    expect(height % SIZE_STEP).toBe(0);
  });

  it("clamps an oversized request back into the pixel budget", () => {
    const { width, height } = parse(resolveOutputSize(1920, 1080, { width: 8000, height: 4000 }));
    expect(Math.max(width, height)).toBe(MAX_OUTPUT_EDGE);
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(MIN_OUTPUT_EDGE);
  });

  it("raises a tiny request to the smallest size the API takes", () => {
    const { width, height } = parse(resolveOutputSize(1920, 1080, { width: 2, height: 2 }));
    expect(width).toBe(MIN_OUTPUT_EDGE);
    expect(height).toBe(MIN_OUTPUT_EDGE);
  });

  it("clamps an extreme requested aspect to the API's 3:1 limit, keeping the orientation", () => {
    const wide = parse(resolveOutputSize(1920, 1080, { width: 1536, height: 100 }));
    expect(wide.width).toBeGreaterThan(wide.height);
    expect(wide.width / wide.height).toBeLessThanOrEqual(MAX_ASPECT);

    const tall = parse(resolveOutputSize(1920, 1080, { width: 100, height: 1536 }));
    expect(tall.height).toBeGreaterThan(tall.width);
    expect(tall.height / tall.width).toBeLessThanOrEqual(MAX_ASPECT);
  });

  it("never emits a size the API would reject, whatever was requested", () => {
    const requests = [
      [1, 1],
      [10000, 1],
      [1, 10000],
      [1537, 1023],
      [255, 255],
      [Infinity, 100],
      [2560, 1440],
    ] as const;

    for (const [w, h] of requests) {
      const { width, height } = parse(resolveOutputSize(1920, 1080, { width: w, height: h }));
      expect(width % SIZE_STEP, `width for ${w}x${h}`).toBe(0);
      expect(height % SIZE_STEP, `height for ${w}x${h}`).toBe(0);
      expect(Math.min(width, height), `min edge for ${w}x${h}`).toBeGreaterThanOrEqual(
        MIN_OUTPUT_EDGE,
      );
      expect(Math.max(width, height), `max edge for ${w}x${h}`).toBeLessThanOrEqual(
        MAX_OUTPUT_EDGE,
      );
      const ratio = Math.max(width, height) / Math.min(width, height);
      expect(ratio, `ratio for ${w}x${h}`).toBeLessThanOrEqual(MAX_ASPECT);
    }
  });

  it("falls back rather than trusting a degenerate size through", () => {
    expect(resolveOutputSize(1920, 1080, { width: 0, height: 1024 })).toBe(FALLBACK_SIZE);
    expect(resolveOutputSize(1920, 1080, { width: 1024, height: NaN })).toBe(FALLBACK_SIZE);
    expect(resolveOutputSize(1920, 1080, { width: -1024, height: 1024 })).toBe(FALLBACK_SIZE);
  });

  it("matches the 3D view when no size is requested", () => {
    expect(resolveOutputSize(1920, 1080, null)).toBe(resolveOutputSize(1920, 1080));
    expect(resolveOutputSize(1920, 1080, undefined)).toBe(resolveOutputSize(1920, 1080));
  });
});

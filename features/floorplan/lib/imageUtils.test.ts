import { describe, expect, it } from "vitest";
import { MAX_IMAGE_SIZE, fitWithin } from "./imageUtils";

/**
 * Only the sizing arithmetic is covered here. The rest of `imageUtils` drives
 * `Image`, `URL.createObjectURL` and a canvas, which need a real browser rather
 * than a mocked DOM to tell you anything true.
 */
describe("fitWithin", () => {
  it("leaves an image that already fits untouched", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("never upscales, even for a tiny image", () => {
    expect(fitWithin(10, 10, 1600)).toEqual({ width: 10, height: 10 });
  });

  it("scales the longest side down to the limit", () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it("uses the taller side for a portrait image", () => {
    expect(fitWithin(1600, 3200, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it("preserves the aspect ratio within rounding", () => {
    const { width, height } = fitWithin(4000, 2250, 1600);
    expect(Math.abs(width / height - 4000 / 2250)).toBeLessThan(0.01);
  });

  it("keeps both edges at least 1px for an extreme panorama", () => {
    const { width, height } = fitWithin(10000, 3, 1600);
    expect(width).toBe(1600);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("treats an image exactly on the limit as already fitting", () => {
    expect(fitWithin(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("defaults to the shared max size", () => {
    expect(fitWithin(MAX_IMAGE_SIZE * 2, MAX_IMAGE_SIZE * 2)).toEqual({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
    });
  });
});

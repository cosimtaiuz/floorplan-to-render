import { describe, expect, it } from "vitest";
import {
  CAMERA_HORIZONTAL_FOV_DEG,
  FOV_HALF_ANGLE_DEG,
  VIEWBOX_WIDTH,
  angleBetween,
  clamp01,
  markerShapes,
  polar,
} from "./cameraMarkerGeometry";

/** The marker and the 3D camera must agree, so this pairing is load-bearing. */
describe("field of view", () => {
  it("keeps the half angle consistent with the full horizontal fov", () => {
    expect(FOV_HALF_ANGLE_DEG * 2).toBe(CAMERA_HORIZONTAL_FOV_DEG);
  });
});

describe("polar", () => {
  it("uses image convention: 0 deg points right, 90 deg points down", () => {
    const right = polar(0, 0, 0, 10);
    expect(right.x).toBeCloseTo(10);
    expect(right.y).toBeCloseTo(0);

    const down = polar(0, 0, 90, 10);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(10);
  });

  it("offsets from the given centre", () => {
    const p = polar(100, 50, 180, 10);
    expect(p.x).toBeCloseTo(90);
    expect(p.y).toBeCloseTo(50);
  });

  it("returns the centre for a zero length", () => {
    const p = polar(7, 9, 123, 0);
    expect(p.x).toBeCloseTo(7);
    expect(p.y).toBeCloseTo(9);
  });
});

describe("angleBetween", () => {
  it("is the inverse of polar for the cardinal directions", () => {
    const from = { x: 0, y: 0 };
    expect(angleBetween(from, { x: 10, y: 0 })).toBe(0);
    expect(angleBetween(from, { x: 0, y: 10 })).toBe(90);
    expect(angleBetween(from, { x: -10, y: 0 })).toBe(180);
    expect(angleBetween(from, { x: 0, y: -10 })).toBe(-90);
  });

  it("round-trips an angle through polar and back", () => {
    for (const angle of [0, 30, 90, 150, 179]) {
      const target = polar(0, 0, angle, 100);
      expect(angleBetween({ x: 0, y: 0 }, target)).toBe(angle);
    }
  });

  it("returns 0 when the points coincide, rather than NaN", () => {
    expect(angleBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe("clamp01", () => {
  it("passes through values already inside the range", () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
  });

  it("clamps a drag that leaves the plan", () => {
    expect(clamp01(-0.3)).toBe(0);
    expect(clamp01(1.7)).toBe(1);
  });
});

describe("markerShapes", () => {
  const camera = { x: 0.5, y: 0.5, angleDeg: 0 };

  it("centres the marker on the normalized position", () => {
    const { center } = markerShapes(camera, 800, 600);
    expect(center).toEqual({ x: 400, y: 300 });
  });

  it("scales sizes by the viewbox unit so the marker stays proportional", () => {
    expect(markerShapes(camera, VIEWBOX_WIDTH, VIEWBOX_WIDTH).unit).toBe(1);
    expect(markerShapes(camera, VIEWBOX_WIDTH * 2, VIEWBOX_WIDTH).unit).toBe(2);
  });

  it("puts the handle ahead of the camera, along the facing direction", () => {
    const { center, handle } = markerShapes(camera, 1000, 1000);
    expect(handle.x).toBeGreaterThan(center.x);
    expect(handle.y).toBeCloseTo(center.y);
  });

  it("spreads the fov edges symmetrically around the facing direction", () => {
    const { center, fovLeft, fovRight } = markerShapes(camera, 1000, 1000);
    const left = angleBetween(center, fovLeft);
    const right = angleBetween(center, fovRight);
    expect(left).toBe(-FOV_HALF_ANGLE_DEG);
    expect(right).toBe(FOV_HALF_ANGLE_DEG);
    // The opening between them is exactly the camera's horizontal fov.
    expect(right - left).toBe(CAMERA_HORIZONTAL_FOV_DEG);
  });

  it("rotates the whole marker with the camera angle", () => {
    const { center, handle } = markerShapes({ x: 0.5, y: 0.5, angleDeg: 90 }, 1000, 1000);
    expect(handle.x).toBeCloseTo(center.x);
    expect(handle.y).toBeGreaterThan(center.y);
  });

  it("handles a marker in the corner of a non-square plan", () => {
    const { center } = markerShapes({ x: 0, y: 1, angleDeg: 0 }, 1600, 400);
    expect(center).toEqual({ x: 0, y: 400 });
  });
});

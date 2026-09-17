import type { CameraMarker } from "@/features/floorplan/types";

/**
 * Geometry shared by the on-screen SVG marker (`components/CameraMarker.tsx`)
 * and the 3D harness (`lib/sceneTemplate.ts`), so the cone drawn on the plan is
 * exactly what the virtual camera sees.
 */

/** Horizontal field of view of the virtual camera, in degrees. */
export const CAMERA_HORIZONTAL_FOV_DEG = 90;
/** Eye height of a standing person, in meters: the virtual camera is pinned to it. */
export const CAMERA_EYE_HEIGHT_M = 1.7;
export const FOV_HALF_ANGLE_DEG = CAMERA_HORIZONTAL_FOV_DEG / 2;

/** Reference width the marker sizes are expressed in; height follows the image aspect. */
export const VIEWBOX_WIDTH = 1000;
export const FOV_LENGTH = 170;
/** Distance from the camera to the rotation handle. */
export const HANDLE_DISTANCE = 115;
export const HANDLE_RADIUS = 9;
/** Radius of the area that grabs the camera icon for dragging. */
export const ICON_HIT_RADIUS = 28;

/**
 * Top-down camera silhouette pointing towards +x, centred on the origin, in
 * VIEWBOX units. Valid SVG path data, so it also feeds `new Path2D(...)`.
 * Body with rounded corners, a lens trapezoid at the front, a viewfinder at the back.
 */
export const CAMERA_ICON_PATH =
  "M-14 -13 H2 A4 4 0 0 1 6 -9 V9 A4 4 0 0 1 2 13 H-14 A4 4 0 0 1 -18 9 V-9 A4 4 0 0 1 -14 -13 Z " +
  "M6 -6 L18 -11 V11 L6 6 Z " +
  "M-18 -5 H-23 V5 H-18 Z";

export const MARKER_FILL = "rgba(37, 99, 235, 0.16)";
export const MARKER_STROKE = "rgba(37, 99, 235, 0.65)";
export const MARKER_ACCENT = "#2563eb";
export const MARKER_ICON = "#1d4ed8";
export const MARKER_OUTLINE = "#ffffff";

export type Point = { x: number; y: number };

export type MarkerShapes = {
  center: Point;
  handle: Point;
  fovLeft: Point;
  fovRight: Point;
  /** Multiply VIEWBOX-based sizes by this to get sizes in the target surface. */
  unit: number;
};

export function polar(cx: number, cy: number, angleDeg: number, length: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * length, y: cy + Math.sin(rad) * length };
}

/** Angle (degrees, image convention: 0 = right, 90 = down) from `from` towards `to`. */
export function angleBetween(from: Point, to: Point): number {
  return Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Converts the normalized marker into drawing coordinates for a canvas/viewBox of
 * the given size. `unit` lets callers draw on a larger surface while keeping the
 * marker proportional to the `VIEWBOX_WIDTH` reference.
 */
export function markerShapes(camera: CameraMarker, width: number, height: number): MarkerShapes {
  const unit = width / VIEWBOX_WIDTH;
  const cx = camera.x * width;
  const cy = camera.y * height;
  return {
    center: { x: cx, y: cy },
    handle: polar(cx, cy, camera.angleDeg, HANDLE_DISTANCE * unit),
    fovLeft: polar(cx, cy, camera.angleDeg - FOV_HALF_ANGLE_DEG, FOV_LENGTH * unit),
    fovRight: polar(cx, cy, camera.angleDeg + FOV_HALF_ANGLE_DEG, FOV_LENGTH * unit),
    unit,
  };
}

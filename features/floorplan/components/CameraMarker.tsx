"use client";

import { memo, useCallback, useRef } from "react";
import type { PointerEvent } from "react";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import {
  CAMERA_ICON_PATH,
  HANDLE_RADIUS,
  ICON_HIT_RADIUS,
  MARKER_ACCENT,
  MARKER_FILL,
  MARKER_ICON,
  MARKER_OUTLINE,
  MARKER_STROKE,
  VIEWBOX_WIDTH,
  angleBetween,
  clamp01,
  markerShapes,
} from "@/features/floorplan/lib/cameraMarkerGeometry";
import type { Point } from "@/features/floorplan/lib/cameraMarkerGeometry";
import { AspectFit } from "./AspectFit";

/** Default look direction when the camera is first placed: "up" on the plan. */
const DEFAULT_ANGLE_DEG = -90;
/** Extra slack around the small handle so it is easy to grab on touch screens. */
const HANDLE_HIT_RADIUS = HANDLE_RADIUS * 2.5;

type DragState = { mode: "move"; offsetX: number; offsetY: number } | { mode: "rotate" };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Shows the uploaded floorplan with an SVG overlay:
 * - pointer down on an empty spot places the camera there (and starts dragging it),
 * - dragging the camera icon moves it,
 * - dragging the round handle in front of it rotates the look direction.
 * Coordinates are stored normalized so they don't depend on the rendered size.
 */
function CameraMarkerComponent() {
  const imageDataUrl = useFloorplanStore((s) => s.imageDataUrl);
  const imageAspect = useFloorplanStore((s) => s.imageAspect) ?? 4 / 3;
  const camera = useFloorplanStore((s) => s.camera);
  const setCamera = useFloorplanStore((s) => s.setCamera);

  const svgRef = useRef<SVGSVGElement>(null);
  // Drag bookkeeping lives in a ref: it changes on every move but must not render.
  const dragRef = useRef<DragState | null>(null);

  const viewBoxHeight = Math.round(VIEWBOX_WIDTH / imageAspect);

  /** Pointer position in normalized image coordinates (0..1, unclamped). */
  const toNormalized = useCallback((event: PointerEvent<SVGSVGElement>): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      event.preventDefault();
      svg.setPointerCapture(event.pointerId);

      const pointer = toNormalized(event);
      const current = useFloorplanStore.getState().camera;

      if (current) {
        const shapes = markerShapes(current, VIEWBOX_WIDTH, viewBoxHeight);
        const pointerVb = { x: pointer.x * VIEWBOX_WIDTH, y: pointer.y * viewBoxHeight };

        if (distance(pointerVb, shapes.handle) <= HANDLE_HIT_RADIUS) {
          dragRef.current = { mode: "rotate" };
          return;
        }
        if (distance(pointerVb, shapes.center) <= ICON_HIT_RADIUS) {
          dragRef.current = {
            mode: "move",
            offsetX: current.x - pointer.x,
            offsetY: current.y - pointer.y,
          };
          return;
        }
      }

      setCamera({
        x: clamp01(pointer.x),
        y: clamp01(pointer.y),
        angleDeg: current?.angleDeg ?? DEFAULT_ANGLE_DEG,
      });
      dragRef.current = { mode: "move", offsetX: 0, offsetY: 0 };
    },
    [setCamera, toNormalized, viewBoxHeight],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const current = useFloorplanStore.getState().camera;
      if (!current) return;

      const pointer = toNormalized(event);

      if (drag.mode === "move") {
        const x = clamp01(pointer.x + drag.offsetX);
        const y = clamp01(pointer.y + drag.offsetY);
        if (x === current.x && y === current.y) return;
        setCamera({ ...current, x, y });
        return;
      }

      // Rotation is measured in viewBox space so non-square images don't skew it.
      const center = { x: current.x * VIEWBOX_WIDTH, y: current.y * viewBoxHeight };
      const target = { x: pointer.x * VIEWBOX_WIDTH, y: pointer.y * viewBoxHeight };
      const angleDeg = angleBetween(center, target);
      if (angleDeg === current.angleDeg) return;
      setCamera({ ...current, angleDeg });
    },
    [setCamera, toNormalized, viewBoxHeight],
  );

  const onPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    svgRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  if (!imageDataUrl) return null;

  const shapes = camera ? markerShapes(camera, VIEWBOX_WIDTH, viewBoxHeight) : null;

  return (
    // The plan is fitted into the stage as large as it can be without cropping;
    // the SVG shares its box, so normalized coordinates stay exact at any size.
    <AspectFit aspect={imageAspect} className="rounded-xl border border-line bg-white shadow-card">
      {/* Plain <img>: the source is a data URL, which next/image cannot optimize. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageDataUrl}
        alt="Uploaded floorplan"
        className="absolute inset-0 h-full w-full select-none object-fill"
        draggable={false}
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${viewBoxHeight}`}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {camera && shapes && (
          <g>
            <polygon
              points={`${shapes.center.x},${shapes.center.y} ${shapes.fovLeft.x},${shapes.fovLeft.y} ${shapes.fovRight.x},${shapes.fovRight.y}`}
              fill={MARKER_FILL}
              stroke={MARKER_STROKE}
              strokeWidth={2}
            />
            <line
              x1={shapes.center.x}
              y1={shapes.center.y}
              x2={shapes.handle.x}
              y2={shapes.handle.y}
              stroke={MARKER_ACCENT}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <g className="cursor-grab active:cursor-grabbing">
              <circle
                cx={shapes.handle.x}
                cy={shapes.handle.y}
                r={HANDLE_HIT_RADIUS}
                fill="transparent"
              />
              <circle
                cx={shapes.handle.x}
                cy={shapes.handle.y}
                r={HANDLE_RADIUS}
                fill={MARKER_ACCENT}
                stroke={MARKER_OUTLINE}
                strokeWidth={3}
              />
            </g>
            <g
              className="cursor-move"
              transform={`translate(${shapes.center.x} ${shapes.center.y}) rotate(${camera.angleDeg})`}
            >
              <circle r={ICON_HIT_RADIUS} fill="transparent" />
              <path
                d={CAMERA_ICON_PATH}
                fill={MARKER_ICON}
                stroke={MARKER_OUTLINE}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </g>
          </g>
        )}
      </svg>
    </AspectFit>
  );
}

export const CameraMarker = memo(CameraMarkerComponent);

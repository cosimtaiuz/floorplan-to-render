"use client";

import { memo } from "react";
import type { ReactNode } from "react";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import {
  CAMERA_EYE_HEIGHT_M,
  CAMERA_HORIZONTAL_FOV_DEG,
} from "@/features/floorplan/lib/cameraMarkerGeometry";
import { StepHeading } from "./StepHeading";
import { BUTTON_SMALL, EYEBROW, INSET } from "./ui";

/** Left panel of step 2: how the marker works plus a live readout of its values. */
function CameraStepPanelComponent() {
  const camera = useFloorplanStore((s) => s.camera);
  const clearCamera = useFloorplanStore((s) => s.clearCamera);

  return (
    <>
      <StepHeading title="Place the camera">
        Click the plan to drop a camera where a person would stand. Drag the icon to move it and the
        round handle to aim it. The shaded cone is what the 3D scene and the render will show.
      </StepHeading>

      <div className={`${INSET} p-4 text-xs text-fg-muted`}>
        {camera ? (
          <dl className="grid grid-cols-2 gap-3 animate-rise">
            <Readout label="Position">
              {Math.round(camera.x * 100)}% <span className="text-fg-faint">×</span>{" "}
              {Math.round(camera.y * 100)}%
            </Readout>
            <Readout label="Facing">{camera.angleDeg}°</Readout>
            <Readout label="Field of view">{CAMERA_HORIZONTAL_FOV_DEG}° h</Readout>
            <Readout label="Eye height">{CAMERA_EYE_HEIGHT_M.toFixed(2)} m</Readout>
          </dl>
        ) : (
          <p className="leading-relaxed">
            <span className="font-medium text-fg">No camera yet.</span> This step is optional:
            without one, the model stands in the middle of the largest room at eye height (
            {CAMERA_EYE_HEIGHT_M} m).
          </p>
        )}
      </div>

      {camera && (
        <div>
          <button type="button" onClick={clearCamera} className={BUTTON_SMALL}>
            Remove camera
          </button>
        </div>
      )}
    </>
  );
}

function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={EYEBROW}>{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-fg">{children}</dd>
    </div>
  );
}

export const CameraStepPanel = memo(CameraStepPanelComponent);

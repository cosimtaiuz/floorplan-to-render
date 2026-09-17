"use client";

import { memo } from "react";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { CameraMarker } from "./CameraMarker";
import { CameraStepPanel } from "./CameraStep";
import { RenderResult } from "./RenderResult";
import { RenderStepPanel } from "./RenderStep";
import { SceneStepPanel } from "./SceneStep";
import { ScenePreview } from "./ScenePreview";
import { StepNav } from "./StepNav";
import { Stepper } from "./Stepper";
import { CARD } from "./ui";
import { UploadStage, UploadStepPanel } from "./UploadStep";

/**
 * Left column: a fixed header (the clickable stepper), the instructions and
 * actions of the current step, and a fixed Back / Continue footer. Only the
 * middle part scrolls, and only when a step has more to say than the screen
 * has room for (errors, the generated code...), so the navigation is always
 * in view. Under `lg` the panel sits above the stage and is capped at half
 * the screen so the stage keeps a usable height.
 */
function StepPanelComponent() {
  const step = useFloorplanStore((s) => s.step);
  return (
    <aside className={`${CARD} flex max-h-[50dvh] min-h-0 flex-col overflow-hidden lg:max-h-none`}>
      <div className="border-b border-line px-4 pt-4 pb-3">
        <Stepper />
      </div>
      {/* Keyed on the step so the content fades in on every step change. */}
      <div
        key={step}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 animate-rise"
      >
        {step === 1 && <UploadStepPanel />}
        {step === 2 && <CameraStepPanel />}
        {step === 3 && <SceneStepPanel />}
        {step === 4 && <RenderStepPanel />}
      </div>
      <div className="border-t border-line px-5 py-4">
        <StepNav />
      </div>
    </aside>
  );
}
const StepPanel = memo(StepPanelComponent);

/**
 * Right column: the visual for the current step. It gets exactly the height of
 * its grid row (the viewport minus the page gutters), and every child fits
 * inside that box instead of pushing it taller. On the scene and render steps
 * the dark viewport *is* the card (no inner padding, no second frame) so it
 * gets every pixel available. The render step shows the render alone: the
 * framing of the 3D view was frozen as a screenshot when leaving step 3.
 */
function StageComponent() {
  const step = useFloorplanStore((s) => s.step);
  const fillsCard = step >= 3;
  return (
    <section
      className={`${CARD} flex min-h-0 min-w-0 flex-col overflow-hidden ${fillsCard ? "" : "p-3"}`}
    >
      {step === 1 && <UploadStage />}
      {step === 2 && <CameraMarker />}
      {step === 3 && <ScenePreview />}
      {step === 4 && <RenderResult />}
    </section>
  );
}
const Stage = memo(StageComponent);

/**
 * Layout shell for /floorplan. It is exactly one viewport tall (`h-dvh`, which
 * follows the mobile browser chrome as it shows and hides) and never scrolls as
 * a page: the side panel scrolls on its own if it has to, the stage fits what it
 * shows. It holds no state of its own: every child reads exactly what it needs
 * from the Zustand store, so a ticking clock or a keystroke in the description
 * never re-renders the 3D preview.
 */
export function FloorplanPage() {
  return (
    <main className="canvas-bloom grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 font-sans text-fg sm:gap-4 sm:p-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-1">
      <StepPanel />
      <Stage />
    </main>
  );
}

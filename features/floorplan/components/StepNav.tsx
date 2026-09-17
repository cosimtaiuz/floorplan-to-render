"use client";

import { memo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import type { FloorplanState } from "@/features/floorplan/store/floorplanStore";
import type { FlowStep } from "@/features/floorplan/types";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./ui";

const STEP_NAMES: Record<FlowStep, string> = {
  1: "Upload",
  2: "Camera",
  3: "3D scene",
  4: "Render",
};

type NavState = Pick<
  FloorplanState,
  "step" | "imageDataUrl" | "camera" | "generatedCode" | "status"
>;

/** Whether the current step has produced what the next one needs. */
function canLeave(s: NavState): boolean {
  if (s.step === 1) return s.imageDataUrl !== null;
  if (s.step === 3) return s.generatedCode !== null && s.status !== "loading";
  return true;
}

/** Short on purpose: it shares a ~240px footer with the Back button and must stay on one line. */
function continueLabel(s: NavState): string {
  if (s.step === 2 && !s.camera) return "Skip camera";
  if (s.step === 4) return "";
  return `Next: ${STEP_NAMES[(s.step + 1) as FlowStep]}`;
}

/**
 * Back / Continue footer under every step panel. It knows the rules of each
 * step itself (what must exist before moving on, what the button says), so the
 * panels only have to render their own content.
 */
function StepNavComponent() {
  const { step, canContinue, label } = useFloorplanStore(
    useShallow((s) => ({ step: s.step, canContinue: canLeave(s), label: continueLabel(s) })),
  );
  const setStep = useFloorplanStore((s) => s.setStep);

  const goBack = useCallback(() => setStep((step - 1) as FlowStep), [setStep, step]);
  const goNext = useCallback(() => setStep((step + 1) as FlowStep), [setStep, step]);

  return (
    <div className="flex items-center justify-between gap-3">
      {step > 1 ? (
        <button
          type="button"
          onClick={goBack}
          className={BUTTON_SECONDARY}
          title={`Back to ${STEP_NAMES[(step - 1) as FlowStep]}`}
        >
          <ArrowIcon flipped />
          Back
        </button>
      ) : (
        <span />
      )}
      {step < 4 && (
        <button type="button" onClick={goNext} disabled={!canContinue} className={BUTTON_PRIMARY}>
          {label}
          <ArrowIcon />
        </button>
      )}
    </div>
  );
}

function ArrowIcon({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={flipped ? "rotate-180" : undefined}
    >
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const StepNav = memo(StepNavComponent);

"use client";

import { memo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { maxReachableStep, useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import type { FlowStep } from "@/features/floorplan/types";

const STEPS: ReadonlyArray<{ step: FlowStep; label: string }> = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Camera" },
  { step: 3, label: "3D scene" },
  { step: 4, label: "Render" },
];

type Status = "done" | "current" | "open" | "locked";

const DOT_BASE =
  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out";
const DOT: Record<Status, string> = {
  done: `${DOT_BASE} border-accent/40 bg-accent-soft text-accent group-hover:border-accent group-hover:bg-accent group-hover:text-accent-fg`,
  current: `${DOT_BASE} border-accent bg-accent text-accent-fg shadow-accent ring-4 ring-accent/15`,
  open: `${DOT_BASE} border-line-strong bg-surface text-fg-muted group-hover:border-accent group-hover:text-accent`,
  locked: `${DOT_BASE} border-line bg-surface-muted text-fg-faint`,
};
const LABEL: Record<Status, string> = {
  done: "text-fg-muted group-hover:text-fg",
  current: "text-fg font-semibold",
  open: "text-fg-muted group-hover:text-fg",
  locked: "text-fg-faint",
};

type StepButtonProps = {
  step: FlowStep;
  label: string;
  status: Status;
  onPick: (step: FlowStep) => void;
};

function StepButtonComponent({ step, label, status, onPick }: StepButtonProps) {
  const onClick = useCallback(() => onPick(step), [onPick, step]);
  const isLocked = status === "locked";
  const isCurrent = status === "current";

  return (
    <li className="relative flex flex-1 flex-col items-center">
      {step > 1 && (
        // Line from the previous dot to this one. It stops short of both dots
        // (radius 0.875rem + a 0.25rem gap matching the current ring) because
        // the done dots have a translucent fill the line would show through.
        <span
          aria-hidden="true"
          className={`absolute top-3.5 right-[calc(50%+1.125rem)] left-[calc(-50%+1.125rem)] h-px ${isLocked ? "bg-line-strong" : "bg-accent/40"}`}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={isLocked || isCurrent}
        aria-current={isCurrent ? "step" : undefined}
        aria-label={`Step ${step}: ${label}`}
        title={
          isLocked ? "Complete the previous steps first" : isCurrent ? undefined : `Go to ${label}`
        }
        className={`group flex flex-col items-center gap-1.5 rounded-lg px-1 pb-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isLocked ? "cursor-not-allowed" : isCurrent ? "cursor-default" : "cursor-pointer"
        }`}
      >
        <span className={DOT[status]}>{status === "done" ? <CheckIcon /> : step}</span>
        <span className={`text-[11px] leading-none whitespace-nowrap ${LABEL[status]}`}>
          {label}
        </span>
      </button>
    </li>
  );
}
const StepButton = memo(StepButtonComponent);

/**
 * The four steps of the flow as a clickable progress bar. Every step that has
 * already been unlocked (see `maxReachableStep`) can be opened directly; the
 * rest stay disabled until the work they depend on exists.
 */
function StepperComponent() {
  const { current, max } = useFloorplanStore(
    useShallow((s) => ({ current: s.step, max: maxReachableStep(s) })),
  );
  const setStep = useFloorplanStore((s) => s.setStep);

  const onPick = useCallback((step: FlowStep) => setStep(step), [setStep]);

  return (
    <nav aria-label="Steps">
      <ol className="flex items-start">
        {STEPS.map(({ step, label }) => (
          <StepButton
            key={step}
            step={step}
            label={label}
            status={
              step === current
                ? "current"
                : step < current
                  ? "done"
                  : step <= max
                    ? "open"
                    : "locked"
            }
            onPick={onPick}
          />
        ))}
      </ol>
    </nav>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const Stepper = memo(StepperComponent);

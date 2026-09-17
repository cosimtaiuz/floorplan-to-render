"use client";

import { memo, useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { ElapsedTimer } from "./ElapsedTimer";
import { StepHeading } from "./StepHeading";
import { Spinner } from "./Spinner";
import {
  ALERT_ERROR,
  ALERT_WARNING,
  BUTTON_PRIMARY_STEP,
  BUTTON_SMALL,
  INSET,
  PANEL_TEXT,
} from "./ui";

/** Left panel of step 3: trigger the Three.js generation and read the outcome. */
function SceneStepPanelComponent() {
  const { status, hasCode, summary, errorMessage, runtimeError, sceneTiming, hasCamera } =
    useFloorplanStore(
      useShallow((s) => ({
        status: s.status,
        hasCode: s.generatedCode !== null,
        summary: s.summary,
        errorMessage: s.errorMessage,
        runtimeError: s.runtimeError,
        sceneTiming: s.sceneTiming,
        hasCamera: s.camera !== null,
      })),
    );
  const generate = useFloorplanStore((s) => s.generate);
  const [showCode, setShowCode] = useState(false);

  const onGenerate = useCallback(() => {
    void generate();
  }, [generate]);
  const toggleCode = useCallback(() => setShowCode((v) => !v), []);

  const isLoading = status === "loading";

  return (
    <>
      <StepHeading title="Generate the 3D scene">
        The model reads the plan and writes a Three.js scene of the whole home: walls, ceilings,
        doors, windows and standard furniture in flat colors. Accuracy matters here; materials and
        style come in the next step.
        {hasCamera
          ? " The view starts from your camera, at eye height."
          : " Without a camera the view starts at eye height in the largest room."}{" "}
        Walk around, fly above the plan or jump between rooms with the buttons over the view.
      </StepHeading>

      <button
        type="button"
        onClick={onGenerate}
        disabled={isLoading}
        className={BUTTON_PRIMARY_STEP}
      >
        {isLoading ? (
          <>
            <Spinner />
            Generating scene...
          </>
        ) : (
          <>
            <SparkIcon />
            {hasCode ? "Regenerate scene" : "Generate 3D scene"}
          </>
        )}
      </button>

      <ElapsedTimer label="3D scene" timing={sceneTiming} variant="large" />

      {errorMessage && (
        <div className={ALERT_ERROR}>
          <strong>Generation failed:</strong> {errorMessage}
        </div>
      )}

      {runtimeError && (
        <div className={ALERT_WARNING}>
          <strong>The generated code threw an error:</strong> {runtimeError}
        </div>
      )}

      {summary && (
        <p className={`${INSET} border-l-2 border-l-accent p-3 ${PANEL_TEXT} animate-rise`}>
          {summary}
        </p>
      )}

      {hasCode && (
        <div className="flex flex-col gap-2">
          <div>
            <button type="button" onClick={toggleCode} className={BUTTON_SMALL}>
              <CodeIcon />
              {showCode ? "Hide code" : "View generated code"}
            </button>
          </div>
          {showCode && <GeneratedCode />}
        </div>
      )}
    </>
  );
}

/** Separate component so the (large) code string is only read when displayed. */
function GeneratedCodeComponent() {
  const code = useFloorplanStore((s) => s.generatedCode);
  if (!code) return null;
  return (
    <pre
      className={`${INSET} max-h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-fg animate-rise`}
    >
      {code}
    </pre>
  );
}

/** Both stars are drawn around the middle of the box so the pair sits on the label's optical center. */
function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 4.5c.8 5 3.3 7.5 8.3 8.3-5 .8-7.5 3.3-8.3 8.2-.8-5-3.3-7.4-8.3-8.2 5-.8 7.5-3.3 8.3-8.3z" />
      <path d="M18.8 2c.3 2 1.2 2.9 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.3 2.9-1.2 3.2-3.2z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const GeneratedCode = memo(GeneratedCodeComponent);

export const SceneStepPanel = memo(SceneStepPanelComponent);

"use client";

import { memo, useCallback } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { ElapsedTimer } from "./ElapsedTimer";
import { Spinner } from "./Spinner";
import { StepHeading } from "./StepHeading";
import { ALERT_ERROR, BUTTON_PRIMARY_STEP, BUTTON_SMALL, EYEBROW, KBD, TEXTAREA } from "./ui";

const PLACEHOLDER =
  'e.g. "Scandinavian living room, light oak floor, white walls, a grey linen sofa facing the window, warm afternoon light."';

/** Left panel of step 4: describe the look, render, download. */
function RenderStepPanelComponent() {
  const prompt = useFloorplanStore((s) => s.prompt);
  const setPrompt = useFloorplanStore((s) => s.setPrompt);
  const generateRender = useFloorplanStore((s) => s.generateRender);
  const reset = useFloorplanStore((s) => s.reset);
  const {
    renderStatus,
    renderTiming,
    renderErrorMessage,
    hasRender,
    hasScreenshot,
    screenshotError,
  } = useFloorplanStore(
    useShallow((s) => ({
      renderStatus: s.renderStatus,
      renderTiming: s.renderTiming,
      renderErrorMessage: s.renderErrorMessage,
      hasRender: s.renderImageDataUrl !== null,
      hasScreenshot: s.sceneScreenshot !== null,
      screenshotError: s.screenshotError,
    })),
  );

  const isRendering = renderStatus === "loading";
  const canRender = hasScreenshot && !isRendering;

  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value),
    [setPrompt],
  );

  const onRender = useCallback(() => {
    void generateRender();
  }, [generateRender]);

  // Enter submits (like a chat box); Shift+Enter inserts a newline.
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (canRender) void generateRender();
      }
    },
    [canRender, generateRender],
  );

  return (
    <>
      <StepHeading title="Describe the room and render">
        The render is made from the view you had when you left the 3D scene (go back to reframe it).
        Describe materials, colors, furniture style and mood: geometry and viewpoint are kept, your
        description is applied on top.
      </StepHeading>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between">
          <span className={EYEBROW}>Description</span>
          <span className="hidden items-center gap-1 text-[11px] text-fg-faint sm:flex">
            <kbd className={KBD}>↵</kbd> to render
          </span>
        </span>
        <textarea
          value={prompt}
          onChange={onChange}
          onKeyDown={onKeyDown}
          rows={5}
          placeholder={PLACEHOLDER}
          className={TEXTAREA}
        />
      </label>

      <button
        type="button"
        onClick={onRender}
        disabled={!canRender}
        className={BUTTON_PRIMARY_STEP}
      >
        {isRendering ? (
          <>
            <Spinner />
            Rendering...
          </>
        ) : (
          <>
            <ApertureIcon />
            {hasRender ? "Render again" : "Generate render"}
          </>
        )}
      </button>

      {!hasScreenshot && (
        <div className={ALERT_ERROR}>
          <strong>No view captured:</strong>{" "}
          {screenshotError ?? "go back to the 3D scene and continue again."}
        </div>
      )}

      <ElapsedTimer label="Render" timing={renderTiming} variant="large" />

      {renderErrorMessage && (
        <div className={ALERT_ERROR}>
          <strong>Render failed:</strong> {renderErrorMessage}
        </div>
      )}

      {hasRender && (
        <div className="flex flex-wrap gap-2">
          <DownloadLink />
          <button type="button" onClick={reset} className={BUTTON_SMALL}>
            Start over
          </button>
        </div>
      )}
    </>
  );
}

/** Isolated so the (large) render data URL is only subscribed to where it is used. */
function DownloadLinkComponent() {
  const href = useFloorplanStore((s) => s.renderImageDataUrl);
  if (!href) return null;
  return (
    <a href={href} download="render.jpg" className={BUTTON_SMALL}>
      <DownloadIcon />
      Download render
    </a>
  );
}

function ApertureIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="m14.31 8 5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16 3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DownloadIcon() {
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
        d="M12 4v11m0 0l-4-4m4 4l4-4M4 17v1.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DownloadLink = memo(DownloadLinkComponent);

export const RenderStepPanel = memo(RenderStepPanelComponent);

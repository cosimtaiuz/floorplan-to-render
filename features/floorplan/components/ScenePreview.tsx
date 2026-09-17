"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { buildSceneHtml } from "@/features/floorplan/lib/sceneTemplate";
import { captureSceneScreenshot, isSceneMessage } from "@/features/floorplan/lib/sceneScreenshot";
import { SceneOverlay } from "./SceneOverlay";
import { CubeIcon, StageEmpty, StageOverlay } from "./StagePlaceholder";
import { ALERT_INFO } from "./ui";

/** How long we wait for the iframe to report "ready" before showing a hint. */
const READY_TIMEOUT_MS = 20_000;

/**
 * The sandboxed Three.js viewport of the 3D scene step. It publishes a screenshot
 * function to the store (used to freeze the framing when moving on to the render
 * step), reports readiness/errors, and resumes where the visitor last stood when
 * the step is reopened. It has no frame of its own: the stage card around it is
 * the frame, so the view fills the card edge to edge.
 */
function ScenePreviewComponent() {
  const { generatedCode, startCamera, isLoading, runtimeError, isSceneReady } = useFloorplanStore(
    useShallow((s) => ({
      generatedCode: s.generatedCode,
      startCamera: s.startCamera,
      isLoading: s.status === "loading",
      runtimeError: s.runtimeError,
      isSceneReady: s.isSceneReady,
    })),
  );
  const setRuntimeError = useFloorplanStore((s) => s.setRuntimeError);
  const setSceneReady = useFloorplanStore((s) => s.setSceneReady);
  const setSceneCapture = useFloorplanStore((s) => s.setSceneCapture);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [slowForCode, setSlowForCode] = useState<string | null>(null);

  // Rebuilt only when the scene changes; changing srcDoc reloads the iframe. The
  // last view is read once here (not subscribed to): it changes while walking and
  // must not reload the iframe, it only matters for the first frame after a remount.
  const srcDoc = useMemo(
    () =>
      generatedCode
        ? buildSceneHtml(generatedCode, {
            start: startCamera,
            resume: useFloorplanStore.getState().lastView,
          })
        : null,
    [generatedCode, startCamera],
  );

  useEffect(() => {
    if (!generatedCode) return;

    const onMessage = (event: MessageEvent) => {
      // Only trust messages coming from our own iframe.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isSceneMessage(event.data)) return;
      if (event.data.type === "ready") {
        setSceneReady(true);
      } else if (event.data.type === "error") {
        setRuntimeError(event.data.message);
      }
      // "screenshot" replies are consumed by captureSceneScreenshot.
    };

    const timeout = window.setTimeout(() => setSlowForCode(generatedCode), READY_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
      // A new code string (or unmount) means the old view is gone.
      setSceneReady(false);
    };
  }, [generatedCode, setRuntimeError, setSceneReady]);

  useEffect(() => {
    setSceneCapture(() => {
      const iframe = iframeRef.current;
      if (!iframe) return Promise.reject(new Error("The 3D preview is not loaded."));
      return captureSceneScreenshot(iframe);
    });
    return () => setSceneCapture(null);
  }, [setSceneCapture]);

  const showSlowHint =
    srcDoc !== null && !isSceneReady && !runtimeError && slowForCode === generatedCode;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-stage">
        {srcDoc ? (
          <>
            <iframe
              ref={iframeRef}
              title="Generated Three.js scene"
              sandbox="allow-scripts"
              srcDoc={srcDoc}
              className="absolute inset-0 h-full w-full"
            />
            <SceneOverlay iframeRef={iframeRef} visible={isSceneReady} />
          </>
        ) : (
          <StageEmpty
            icon={<CubeIcon />}
            isBusy={isLoading}
            title={isLoading ? "Building the 3D scene" : "Your 3D scene will appear here"}
            hint={
              isLoading
                ? "The scene is being generated. This can take a minute."
                : "Every room with its walls, doors, windows and furniture. Walk through it, fly above it or jump between rooms."
            }
          />
        )}

        {isLoading && srcDoc && <StageOverlay>Generating a new scene...</StageOverlay>}
      </div>

      {showSlowHint && (
        <div className={`${ALERT_INFO} m-3`}>
          The preview has not reported back yet. Three.js is loaded from a CDN inside the preview;
          check your network connection if nothing appears.
        </div>
      )}
    </div>
  );
}

export const ScenePreview = memo(ScenePreviewComponent);

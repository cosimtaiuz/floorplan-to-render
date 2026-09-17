import { SCENE_MESSAGE_SOURCE, SCREENSHOT_MAX_SIZE } from "./sceneTemplate";
import type { SceneCommand, SceneMessage } from "./sceneTemplate";
import type { SceneScreenshot } from "@/features/floorplan/types";

/** How long we wait for the iframe to answer a capture request. */
const CAPTURE_TIMEOUT_MS = 10_000;

export function isSceneMessage(data: unknown): data is SceneMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === SCENE_MESSAGE_SOURCE
  );
}

/**
 * Asks the sandboxed preview iframe for a screenshot of its current view.
 *
 * The iframe runs in an opaque origin (`sandbox="allow-scripts"`), so the parent
 * cannot read its canvas directly; instead we exchange `postMessage` events and
 * correlate the reply with a request id.
 */
export function captureSceneScreenshot(
  iframe: HTMLIFrameElement,
  timeoutMs: number = CAPTURE_TIMEOUT_MS,
): Promise<SceneScreenshot> {
  const target = iframe.contentWindow;
  if (!target) return Promise.reject(new Error("The 3D preview is not loaded."));

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== target) return;
      if (!isSceneMessage(event.data)) return;
      if (event.data.type !== "screenshot" || event.data.requestId !== requestId) return;
      cleanup();
      const { dataUrl, width, height } = event.data;
      resolve({ dataUrl, width, height });
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The 3D preview did not return a screenshot in time."));
    }, timeoutMs);

    window.addEventListener("message", onMessage);

    const command: SceneCommand = {
      source: SCENE_MESSAGE_SOURCE,
      type: "capture",
      requestId,
      maxSize: SCREENSHOT_MAX_SIZE,
    };
    // "*" is required: a sandboxed iframe without allow-same-origin has an opaque origin.
    target.postMessage(command, "*");
  });
}

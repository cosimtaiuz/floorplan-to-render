import { SCENE_MESSAGE_SOURCE } from "./sceneTemplate";
import type { MoveAction, SceneCommand, ViewMode } from "./sceneTemplate";
import type { ScenePose } from "@/features/floorplan/types";

/** Everything a command carries except the `source` tag added here. */
export type SceneCommandInput = SceneCommand extends infer C
  ? C extends { source: string }
    ? Omit<C, "source">
    : never
  : never;

/**
 * Posts a command to the preview iframe. Silently does nothing when the iframe
 * is not mounted: the overlay buttons are visible before the scene reports ready
 * and a lost keypress is not worth an error.
 */
export function sendSceneCommand(iframe: HTMLIFrameElement | null, input: SceneCommandInput): void {
  const target = iframe?.contentWindow;
  if (!target) return;
  const command = { source: SCENE_MESSAGE_SOURCE, ...input } as SceneCommand;
  // "*" is required: a sandboxed iframe without allow-same-origin has an opaque origin.
  target.postMessage(command, "*");
}

export function pressAction(
  iframe: HTMLIFrameElement | null,
  action: MoveAction,
  pressed: boolean,
) {
  sendSceneCommand(iframe, { type: "input", action, pressed });
}

export function setViewMode(iframe: HTMLIFrameElement | null, mode: ViewMode) {
  sendSceneCommand(iframe, { type: "setMode", mode });
}

export function resetView(iframe: HTMLIFrameElement | null) {
  sendSceneCommand(iframe, { type: "resetView" });
}

export function teleportTo(iframe: HTMLIFrameElement | null, pose: ScenePose) {
  sendSceneCommand(iframe, { type: "teleport", pose });
}

export function showTopView(iframe: HTMLIFrameElement | null) {
  sendSceneCommand(iframe, { type: "topView" });
}

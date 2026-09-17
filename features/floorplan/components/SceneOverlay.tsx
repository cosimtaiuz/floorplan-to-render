"use client";

import { memo, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ViewMode } from "@/features/floorplan/lib/sceneTemplate";
import { isSceneMessage } from "@/features/floorplan/lib/sceneScreenshot";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { RoomSwitcher } from "./RoomSwitcher";
import type { FloorPosition } from "./RoomSwitcher";
import { SceneControls } from "./SceneControls";

type Props = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** Hidden until the scene reports ready; the listener stays mounted so no `view` message is missed. */
  visible: boolean;
};

/**
 * Everything drawn on top of the 3D view. It listens to the iframe's `view`
 * messages itself so the camera position (which changes while walking) only
 * re-renders these small controls, never the iframe underneath.
 */
function SceneOverlayComponent({ iframeRef, visible }: Props) {
  const [mode, setMode] = useState<ViewMode>("walk");
  const [position, setPosition] = useState<FloorPosition | null>(null);
  const setLastView = useFloorplanStore((s) => s.setLastView);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isSceneMessage(event.data) || event.data.type !== "view") return;
      const { mode: nextMode, pose } = event.data;
      setMode(nextMode);
      setPosition((prev) =>
        prev && prev.x === pose.x && prev.z === pose.z ? prev : { x: pose.x, z: pose.z },
      );
      // Remembered so the preview can resume here after the render step.
      setLastView(pose);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef, setLastView]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <RoomSwitcher iframeRef={iframeRef} position={position} />
      <SceneControls iframeRef={iframeRef} mode={mode} />
    </div>
  );
}

export const SceneOverlay = memo(SceneOverlayComponent);

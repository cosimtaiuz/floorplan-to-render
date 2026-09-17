"use client";

import { memo, useCallback } from "react";
import type { PointerEvent, ReactNode, RefObject } from "react";
import type { MoveAction, ViewMode } from "@/features/floorplan/lib/sceneTemplate";
import {
  pressAction,
  resetView,
  setViewMode,
  showTopView,
} from "@/features/floorplan/lib/sceneCommands";

type IframeRef = RefObject<HTMLIFrameElement | null>;

const HOLD_BUTTON =
  "flex h-9 w-9 select-none items-center justify-center rounded-md border border-white/15 bg-black/55 text-base leading-none text-zinc-100 backdrop-blur transition-colors hover:bg-black/75 active:bg-accent active:text-white touch-none";
const CHIP_BUTTON =
  "h-8 select-none rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent";
const CHIP_ACTIVE = `${CHIP_BUTTON} bg-accent text-white`;
const ACTION_BUTTON =
  "h-9 rounded-lg border border-white/15 bg-black/55 px-3 text-xs font-medium text-zinc-100 backdrop-blur transition-colors hover:bg-black/75";
const CHIP_IDLE = `${CHIP_BUTTON} text-zinc-200 hover:bg-white/10`;

type HoldButtonProps = {
  action: MoveAction;
  label: string;
  children: ReactNode;
  onHold: (action: MoveAction, pressed: boolean) => void;
};

/**
 * A button that moves while it is held down (mouse or finger) and stops as soon
 * as the pointer is released or leaves the button.
 */
function HoldButtonComponent({ action, label, children, onHold }: HoldButtonProps) {
  const onDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      // Keep keyboard focus where it is (usually the 3D view) so keys keep working.
      event.preventDefault();
      onHold(action, true);
    },
    [action, onHold],
  );
  const onUp = useCallback(() => onHold(action, false), [action, onHold]);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={HOLD_BUTTON}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      onContextMenu={preventDefault}
    >
      {children}
    </button>
  );
}
const HoldButton = memo(HoldButtonComponent);

function preventDefault(event: { preventDefault: () => void }) {
  event.preventDefault();
}

type Props = {
  iframeRef: IframeRef;
  mode: ViewMode;
};

/**
 * On-screen controls for the 3D view: a d-pad plus turn buttons (hold to move),
 * up/down when flying, the Walk/Fly switch, "Top view" (dollhouse) and "Reset
 * view". Everything is sent to the sandboxed iframe as `postMessage` commands.
 */
function SceneControlsComponent({ iframeRef, mode }: Props) {
  const onHold = useCallback(
    (action: MoveAction, pressed: boolean) => pressAction(iframeRef.current, action, pressed),
    [iframeRef],
  );
  const onWalk = useCallback(() => {
    setViewMode(iframeRef.current, "walk");
    iframeRef.current?.focus();
  }, [iframeRef]);
  const onFly = useCallback(() => {
    setViewMode(iframeRef.current, "fly");
    iframeRef.current?.focus();
  }, [iframeRef]);
  const onReset = useCallback(() => {
    resetView(iframeRef.current);
    iframeRef.current?.focus();
  }, [iframeRef]);
  const onTopView = useCallback(() => {
    showTopView(iframeRef.current);
    iframeRef.current?.focus();
  }, [iframeRef]);

  const isFly = mode === "fly";

  return (
    <>
      <div className="pointer-events-auto absolute bottom-3 left-3 flex items-end gap-2">
        <div className="grid grid-cols-3 gap-1">
          <HoldButton action="turnLeft" label="Turn left (Q or ←)" onHold={onHold}>
            ↶
          </HoldButton>
          <HoldButton action="forward" label="Move forward (W or ↑)" onHold={onHold}>
            ↑
          </HoldButton>
          <HoldButton action="turnRight" label="Turn right (E or →)" onHold={onHold}>
            ↷
          </HoldButton>
          <HoldButton action="left" label="Step left (A)" onHold={onHold}>
            ←
          </HoldButton>
          <HoldButton action="back" label="Move back (S or ↓)" onHold={onHold}>
            ↓
          </HoldButton>
          <HoldButton action="right" label="Step right (D)" onHold={onHold}>
            →
          </HoldButton>
        </div>
        {isFly && (
          <div className="grid gap-1">
            <HoldButton action="up" label="Go up (R)" onHold={onHold}>
              ⇡
            </HoldButton>
            <HoldButton action="down" label="Go down (F)" onHold={onHold}>
              ⇣
            </HoldButton>
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-2">
        <div
          role="group"
          aria-label="View mode"
          className="flex gap-0.5 rounded-lg border border-white/15 bg-black/55 p-0.5 backdrop-blur"
        >
          <button
            type="button"
            aria-pressed={!isFly}
            onClick={onWalk}
            className={isFly ? CHIP_IDLE : CHIP_ACTIVE}
            title="Walk at eye height (V toggles)"
          >
            Walk
          </button>
          <button
            type="button"
            aria-pressed={isFly}
            onClick={onFly}
            className={isFly ? CHIP_ACTIVE : CHIP_IDLE}
            title="Fly freely, look from above (V toggles)"
          >
            Fly
          </button>
        </div>
        <button
          type="button"
          onClick={onTopView}
          title="See the whole plan from above (T)"
          className={ACTION_BUTTON}
        >
          Top view
        </button>
        <button
          type="button"
          onClick={onReset}
          title="Back to the starting camera (H)"
          className={ACTION_BUTTON}
        >
          Reset view
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-1/2 hidden max-w-[40%] -translate-x-1/2 rounded-md bg-black/45 px-2.5 py-1.5 text-center text-[11px] leading-snug text-zinc-300 backdrop-blur md:block">
        Click the view, then drag to look around · <kbd>W A S D</kbd> or arrows to move · scroll to
        step forward · <kbd>Shift</kbd> = faster{isFly && " · R / F = up / down"}
      </p>
    </>
  );
}

export const SceneControls = memo(SceneControlsComponent);

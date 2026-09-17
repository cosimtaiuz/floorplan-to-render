"use client";

import { memo, useEffect, useState } from "react";
import type { Timing } from "@/features/floorplan/types";
import { EYEBROW, INSET } from "./ui";

const TICK_MS = 100;

/**
 * The stopwatch is a debugging aid for model latency, not a product feature.
 * `NODE_ENV` is inlined at build time, so in production the whole component
 * (and its interval) is dead code.
 */
const SHOW_TIMER = process.env.NODE_ENV === "development";

/** "12.3s" under a minute, "1:05.2" above. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (minutes === 0) return `${seconds.toFixed(1)}s`;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

type Props = {
  label: string;
  timing: Timing;
  /** `chip` for the header, `large` inside a step panel. */
  variant?: "chip" | "large";
};

/**
 * Stopwatch for one model call. It ticks with its own interval while the call is
 * running, so nothing else on the page re-renders ten times a second.
 */
function ElapsedTimerComponent({ label, timing, variant = "chip" }: Props) {
  const { startedAt, durationMs } = timing;
  const isRunning = startedAt !== null && durationMs === null;

  // Only meaningful while running; `now - startedAt` is clamped at 0 for the
  // first tick after a restart (when `now` may still be from the previous run).
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [isRunning, startedAt]);

  const elapsedMs = isRunning ? Math.max(0, now - startedAt) : durationMs;
  const text = elapsedMs === null ? "--" : formatDuration(elapsedMs);

  const isDone = durationMs !== null;

  if (variant === "large") {
    return (
      <div
        className={`${INSET} flex items-center justify-between px-4 py-3 transition-colors duration-300 ${
          isRunning ? "border-accent/30 bg-accent-soft" : ""
        }`}
      >
        <span className="flex items-center gap-2">
          <span className={isRunning ? "text-accent" : "text-fg-faint"}>
            <ClockIcon />
          </span>
          <span className={EYEBROW}>{label}</span>
        </span>
        <span
          className={`font-mono text-xl tabular-nums tracking-tight ${
            isRunning ? "text-accent" : isDone ? "text-fg" : "text-fg-faint"
          }`}
          aria-live="off"
        >
          {text}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs tabular-nums transition-colors duration-300 ${
        isRunning
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-line bg-surface text-fg-muted shadow-card"
      }`}
      title={`Time spent generating the ${label.toLowerCase()}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isRunning ? "animate-pulse bg-accent" : isDone ? "bg-success" : "bg-line-strong"
        }`}
        aria-hidden="true"
      />
      <span>{label}</span>
      <span className={`font-mono ${isDone || isRunning ? "text-fg" : "text-fg-faint"}`}>
        {text}
      </span>
    </span>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Renders nothing outside `next dev`; the hooks live in the inner component so this early return is safe. */
function DevOnlyElapsedTimer(props: Props) {
  if (!SHOW_TIMER) return null;
  return <ElapsedTimerComponent {...props} />;
}

export const ElapsedTimer = memo(DevOnlyElapsedTimer);

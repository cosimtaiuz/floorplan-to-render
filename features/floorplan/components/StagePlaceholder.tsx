import { memo } from "react";
import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

type EmptyProps = {
  icon: ReactNode;
  title: string;
  hint?: string;
  isBusy?: boolean;
};

/**
 * Centered placeholder inside the dark stage (3D viewport / render frame).
 * Always drawn on the dark `bg-stage`, so colors are fixed rather than tokens.
 */
function StageEmptyComponent({ icon, title, hint, isBusy = false }: EmptyProps) {
  return (
    <div className="dot-grid flex h-full flex-col items-center justify-center gap-4 p-6 text-center [--line-strong:rgba(255,255,255,0.08)]">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${
          isBusy ? "text-accent" : "text-zinc-400"
        }`}
      >
        {isBusy ? <Spinner size={22} /> : icon}
      </span>
      <div className="flex max-w-xs flex-col gap-1">
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        {hint && <span className="text-xs leading-relaxed text-zinc-500">{hint}</span>}
      </div>
    </div>
  );
}

export const StageEmpty = memo(StageEmptyComponent);

/** Frosted overlay shown on top of existing content while it is being replaced. */
function StageOverlayComponent({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-stage/60 backdrop-blur-sm animate-rise">
      <span className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm text-zinc-100 shadow-pop">
        <Spinner size={14} className="text-accent" />
        {children}
      </span>
    </div>
  );
}

export const StageOverlay = memo(StageOverlayComponent);

export function CubeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path
        d="M20.5 15.5l-4.3-4.3a1.5 1.5 0 00-2.1 0L6 19.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

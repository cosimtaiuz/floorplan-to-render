/**
 * Shared Tailwind class strings. Everything uses the semantic tokens declared in
 * app/globals.css, so light/dark is handled once in CSS rather than per element.
 */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const BUTTON_PRIMARY = `${BUTTON_BASE} h-11 px-5 bg-accent text-accent-fg shadow-accent hover:bg-accent-strong hover:shadow-pop disabled:hover:bg-accent disabled:shadow-none`;

/**
 * The action a step panel is built around ("Generate 3D scene", "Generate
 * render"). It fills the panel column, which is a narrow sidebar on desktop,
 * but stops growing before it turns into a banner when the panel spans the
 * whole width under `lg`.
 */
export const BUTTON_PRIMARY_STEP = `${BUTTON_PRIMARY} w-full max-w-80 self-start`;

export const BUTTON_SECONDARY = `${BUTTON_BASE} h-11 px-4 border border-line-strong bg-surface text-fg shadow-card hover:border-fg-faint hover:bg-surface-raised`;

export const BUTTON_SMALL = `${BUTTON_BASE} h-8 px-3 text-xs border border-line-strong bg-surface text-fg hover:border-fg-faint hover:bg-surface-raised`;

export const BUTTON_SMALL_DANGER = `${BUTTON_BASE} h-8 px-3 text-xs border border-danger/40 bg-surface text-danger hover:bg-danger-soft`;

const ALERT_BASE = "rounded-xl border p-3 text-xs leading-relaxed animate-rise";
export const ALERT_ERROR = `${ALERT_BASE} border-danger/30 bg-danger-soft text-danger`;
export const ALERT_WARNING = `${ALERT_BASE} border-warning/30 bg-warning-soft text-warning`;
export const ALERT_INFO = `${ALERT_BASE} border-line bg-surface-muted text-fg-muted`;

const FIELD_BASE =
  "w-full rounded-xl border border-line-strong bg-surface-raised text-sm text-fg shadow-inset outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-faint focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15";

export const TEXTAREA = `${FIELD_BASE} resize-y p-3 leading-relaxed`;
export const INPUT = `${FIELD_BASE} h-11 px-3`;

/** Small uppercase label above a title ("Step 2 of 4", "Render"). */
export const EYEBROW = "text-md font-semibold uppercase tracking-[0.14em] text-fg-faint";
export const EYEBROW_SMALL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint";
export const PANEL_TITLE = "text-lg font-semibold tracking-tight text-fg";
export const PANEL_TEXT = "text-sm leading-relaxed text-fg-muted";

/** Elevated white/dark card used for the step panel and the stage. */
export const CARD = "rounded-2xl border border-line bg-surface shadow-card";
/** Recessed inner block for read-outs, code and hints. */
export const INSET = "rounded-xl border border-line bg-surface-muted";
/** Inline keyboard key. */
export const KBD =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface px-1.5 font-mono text-[10px] text-fg-muted shadow-inset";

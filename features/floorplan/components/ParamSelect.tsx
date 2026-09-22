"use client";

import type { ChangeEvent, ReactNode } from "react";
import { EYEBROW_SMALL, SELECT } from "./ui";

export type ParamOption<T extends string> = {
  value: T;
  label: string;
};

type ParamSelectProps<T extends string> = {
  label: string;
  /** One line under the control: what picking a value up the scale costs. */
  hint?: ReactNode;
  value: T;
  options: readonly ParamOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
};

/**
 * A model parameter the user sets before a call: reasoning effort, render
 * quality, output size. Deliberately a plain `<select>` — these are short,
 * ordered scales, and the value has to be readable at a glance before
 * committing to a slow, paid generation.
 *
 * The cast on change is safe: every option comes from the same scale as `value`.
 */
export function ParamSelect<T extends string>({
  label,
  hint,
  value,
  options,
  disabled,
  onChange,
}: ParamSelectProps<T>) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={EYEBROW_SMALL}>{label}</span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T)}
          className={SELECT}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </span>
      {hint && <span className="text-[11px] leading-relaxed text-fg-faint">{hint}</span>}
    </label>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-faint"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

"use client";

import { memo, useCallback, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { AspectFit } from "./AspectFit";
import { StepHeading } from "./StepHeading";
import { ACCEPTED_IMAGE_TYPES, useFilePicker } from "./useFilePicker";
import { ALERT_ERROR, BUTTON_SECONDARY, BUTTON_SMALL_DANGER, INSET } from "./ui";

const TIPS: ReadonlyArray<string> = [
  "Dark walls on a light background",
  "Doors and windows visible",
  "One floor per image",
];

/** Left panel of step 1: what to upload, replace / remove, continue. */
function UploadStepPanelComponent() {
  const { hasImage, isReading, error } = useFloorplanStore(
    useShallow((s) => ({
      hasImage: s.imageDataUrl !== null,
      isReading: s.isReadingImage,
      error: s.imageError,
    })),
  );
  const clearImage = useFloorplanStore((s) => s.clearImage);
  const { inputRef, open, onChange } = useFilePicker();

  return (
    <>
      <StepHeading title="Upload your floorplan">
        A clean top-down plan works best. PNG, JPG or WebP; the image is downsized in your browser
        before it is sent.
      </StepHeading>

      <ul className={`${INSET} flex flex-col gap-2 p-3 text-xs text-fg-muted`}>
        {TIPS.map((tip) => (
          <li key={tip} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            {tip}
          </li>
        ))}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={onChange}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={open} disabled={isReading} className={BUTTON_SECONDARY}>
          {isReading ? "Reading image..." : hasImage ? "Replace image" : "Choose a file"}
        </button>
        {hasImage && (
          <button type="button" onClick={clearImage} className={BUTTON_SMALL_DANGER}>
            Remove
          </button>
        )}
      </div>

      {error && <p className={ALERT_ERROR}>{error}</p>}
    </>
  );
}

export const UploadStepPanel = memo(UploadStepPanelComponent);

/** Right side of step 1: a big drop zone, or the uploaded plan once we have one. */
function UploadStageComponent() {
  const { imageDataUrl, imageAspect, isReading } = useFloorplanStore(
    useShallow((s) => ({
      imageDataUrl: s.imageDataUrl,
      imageAspect: s.imageAspect,
      isReading: s.isReadingImage,
    })),
  );
  const loadImageFile = useFloorplanStore((s) => s.loadImageFile);
  const { inputRef, open, onChange } = useFilePicker();
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void loadImageFile(file);
    },
    [loadImageFile],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    },
    [open],
  );

  if (imageDataUrl) {
    return (
      <AspectFit
        aspect={imageAspect ?? 4 / 3}
        className="rounded-xl border border-line bg-white shadow-card animate-rise"
      >
        {/* Plain <img>: the source is a data URL, which next/image cannot optimize. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageDataUrl}
          alt="Uploaded floorplan"
          className="absolute inset-0 h-full w-full object-fill"
          draggable={false}
        />
      </AspectFit>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={onChange}
        className="hidden"
      />
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKeyDown}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`group dot-grid flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isDragging
            ? "border-accent bg-accent-soft shadow-accent"
            : "border-line-strong bg-surface-muted hover:border-accent/60 hover:bg-surface-raised"
        }`}
      >
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface text-fg-muted shadow-card transition-[transform,color,border-color] duration-200 ${
            isDragging
              ? "-translate-y-1 border-accent/40 text-accent"
              : "group-hover:-translate-y-1 group-hover:text-accent"
          }`}
        >
          <UploadIcon />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-sm font-medium text-fg">
            {isReading
              ? "Reading image..."
              : isDragging
                ? "Release to upload"
                : "Drop a floorplan here or click to browse"}
          </span>
          <span className="text-xs text-fg-muted">PNG, JPG or WebP</span>
        </span>
      </div>
    </>
  );
}

function UploadIcon() {
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
      <path d="M12 16V5m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v2.5A2.5 2.5 0 006.5 20h11a2.5 2.5 0 002.5-2.5V15" strokeLinecap="round" />
    </svg>
  );
}

export const UploadStage = memo(UploadStageComponent);

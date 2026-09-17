"use client";

import { useCallback, useRef } from "react";
import type { ChangeEvent } from "react";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

/**
 * Wires a hidden `<input type="file">` to the store. The caller renders the
 * input with `inputRef` / `onChange` and calls `open()` from any button.
 */
export function useFilePicker() {
  const loadImageFile = useFloorplanStore((s) => s.loadImageFile);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => inputRef.current?.click(), []);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) void loadImageFile(file);
      // Reset so picking the same file again still triggers onChange.
      event.target.value = "";
    },
    [loadImageFile],
  );

  return { inputRef, open, onChange };
}

"use client";

import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useFloorplanStore } from "@/features/floorplan/store/floorplanStore";
import { ImageIcon, StageEmpty, StageOverlay } from "./StagePlaceholder";

/**
 * The stage of step 4: the photorealistic render made from the frozen 3D view,
 * nothing else. Frameless, like the 3D view: the stage card is the frame.
 */
function RenderResultComponent() {
  const { renderStatus, renderImageDataUrl } = useFloorplanStore(
    useShallow((s) => ({
      renderStatus: s.renderStatus,
      renderImageDataUrl: s.renderImageDataUrl,
    })),
  );

  const isLoading = renderStatus === "loading";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-stage">
        {renderImageDataUrl ? (
          // Absolutely positioned so the render is scaled into the stage (never
          // the other way round: a tall image must not make the page scroll).
          // Plain <img>: the source is a data URL, which next/image cannot optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={renderImageDataUrl}
            src={renderImageDataUrl}
            alt="Photorealistic render of the generated room"
            className="absolute inset-0 h-full w-full object-contain animate-rise"
          />
        ) : (
          <StageEmpty
            icon={<ImageIcon />}
            isBusy={isLoading}
            title={isLoading ? "Rendering the scene" : "The render will appear here"}
            hint={
              isLoading
                ? "Same camera, same geometry, real materials and light. This can take up to a couple of minutes."
                : "Describe materials, style and mood on the left, then generate."
            }
          />
        )}

        {isLoading && renderImageDataUrl && <StageOverlay>Generating a new render...</StageOverlay>}
      </div>
    </div>
  );
}

export const RenderResult = memo(RenderResultComponent);

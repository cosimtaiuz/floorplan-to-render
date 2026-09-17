import { memo, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  /** width / height of the box to fit. */
  aspect: number;
  /** Classes for the fitted box itself (border, radius, background...). */
  className?: string;
  children: ReactNode;
};

/**
 * Centers a box of a fixed aspect ratio inside the space its parent gives it,
 * as large as possible without cropping or stretching (like `object-contain`,
 * but for any content: here an image plus the SVG overlay drawn on top of it).
 *
 * The fit is pure CSS: the box is `min(100%, 100cqh * aspect)` wide, i.e. it is
 * limited by the width or by the height of the container, whichever bites
 * first. No ResizeObserver, nothing re-renders when the window is resized.
 * The parent must have a definite height (the stage card does).
 */
function AspectFitComponent({ aspect, className = "", children }: Props) {
  const style = useMemo<CSSProperties>(
    () => ({ aspectRatio: aspect, width: `min(100%, calc(100cqh * ${aspect}))` }),
    [aspect],
  );

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <div className="absolute inset-0 flex items-center justify-center [container-type:size]">
        <div style={style} className={`relative overflow-hidden ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export const AspectFit = memo(AspectFitComponent);

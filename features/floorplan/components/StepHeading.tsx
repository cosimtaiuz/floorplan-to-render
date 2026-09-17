import { memo } from "react";
import type { ReactNode } from "react";
import { PANEL_TEXT, PANEL_TITLE } from "./ui";

type Props = {
  title: string;
  children: ReactNode;
};

/** Title and intro paragraph shared by every step panel (the stepper above says which step it is). */
function StepHeadingComponent({ title, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className={PANEL_TITLE}>{title}</h2>
      <p className={PANEL_TEXT}>{children}</p>
    </div>
  );
}

export const StepHeading = memo(StepHeadingComponent);

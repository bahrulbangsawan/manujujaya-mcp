import type { ReactNode } from "react";
import { TONE_BADGE, cx, type Tone } from "./ui";

export type StatusTone = Tone;

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONE_BADGE[tone])}>
      {children}
    </span>
  );
}

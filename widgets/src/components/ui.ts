/** Class-name helpers shared by the widget components. Colors use the Tailwind tokens from styles.css. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "success" | "warning" | "danger" | "neutral";

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-fg-muted",
};

export const TONE_BADGE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-muted text-fg-muted",
};

/** Secondary button on the host surface. */
export const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

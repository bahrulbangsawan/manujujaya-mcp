/** Small helpers shared by the view routes (Tasks 12–13). DOM-free except for the React hook. */
import { useEffect } from "react";
import type { ViewName } from "../../../src/widgets/contract";
import { VIEW_LABEL } from "../app/viewPaths";
import { useBridge } from "../bridge/bridge";
import { PRESET_LABEL, presetRange, type PresetKey } from "../lib/dates";
import { formatDate, formatTime } from "../lib/format";

/** "Outlet 645203 · Diperbarui 10.32" (Asia/Jakarta clock). */
export function viewSubtitle(meta: { outlet_id: string; generated_at: string }): string {
  const time = formatTime(meta.generated_at);
  return time === "—" ? `Outlet ${meta.outlet_id}` : `Outlet ${meta.outlet_id} · Diperbarui ${time}`;
}

/** "9 Sep 2026 – 15 Sep 2026", or one date when start = end. */
export function rangeLabel(range: { start_date: string; end_date: string }): string {
  return range.start_date === range.end_date
    ? formatDate(range.start_date)
    : `${formatDate(range.start_date)} – ${formatDate(range.end_date)}`;
}

const RANGE_PRESETS = (Object.keys(PRESET_LABEL) as PresetKey[]).filter(
  (key): key is Exclude<PresetKey, "custom"> => key !== "custom",
);

/** The preset chip matching start..end as of today, else "custom". */
export function presetFor(range: { start_date: string; end_date: string }, today: string): PresetKey {
  for (const key of RANGE_PRESETS) {
    const candidate = presetRange(key, today);
    if (candidate.start_date === range.start_date && candidate.end_date === range.end_date) return key;
  }
  return "custom";
}

/** One line for updateModelContext: view name plus filter values (never names, phones or amounts). */
export function modelContextText(view: ViewName, args: Record<string, unknown>): string {
  const filters = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
  return `Pengguna membuka tampilan ${VIEW_LABEL[view]} (${view}) di widget Manujujaya. Filter: ${filters === "" ? "bawaan" : filters}.`;
}

/** Tells the host which view and filters are on screen, when the host supports it. */
export function useModelContext(view: ViewName, args: Record<string, unknown>): void {
  const bridge = useBridge();
  const text = modelContextText(view, args);
  useEffect(() => {
    if (!bridge.host.canUpdateContext) return;
    bridge.updateContext(text).catch(() => undefined);
  }, [bridge, text]);
}

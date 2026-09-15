import { useForm } from "@tanstack/react-form";
import { useState, type KeyboardEvent } from "react";
import { z } from "zod";
import { MAX_RANGE_DAYS } from "../../../src/widgets/contract";
import { PRESET_KEYS, PRESET_LABEL, isoDaysBetween, jakartaTodayBrowser, presetRange, type PresetKey } from "../lib/dates";
import { ChipGroup, type ChipOption } from "./ChipGroup";
import { buttonClass } from "./ui";

export interface PresetRangeValue {
  preset: PresetKey;
  start_date: string;
  end_date: string;
}

const PRESET_OPTIONS: ReadonlyArray<ChipOption<PresetKey>> = PRESET_KEYS.map((key) => ({ value: key, label: PRESET_LABEL[key] }));

/** Custom range rules: real dates, start ≤ end, at most MAX_RANGE_DAYS inclusive days (same bounds as the server). */
export const customRangeSchema = z
  .object({
    start_date: z.iso.date("Tanggal awal tidak valid"),
    end_date: z.iso.date("Tanggal akhir tidak valid"),
  })
  .refine((range) => range.start_date <= range.end_date, {
    message: "Tanggal akhir harus sama dengan atau setelah tanggal awal",
    path: ["end_date"],
  })
  .refine((range) => isoDaysBetween(range.start_date, range.end_date) + 1 <= MAX_RANGE_DAYS, {
    message: `Rentang tanggal paling panjang ${MAX_RANGE_DAYS} hari`,
    path: ["end_date"],
  });

export interface PresetRangePickerProps {
  value: PresetRangeValue;
  onChange: (value: PresetRangeValue) => void;
  /** Jakarta calendar date for the presets; defaults to jakartaTodayBrowser(). */
  today?: string;
}

export function PresetRangePicker({ value, onChange, today }: PresetRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const showCustom = customOpen || value.preset === "custom";

  return (
    <div className="space-y-2">
      <ChipGroup
        label="Periode"
        options={PRESET_OPTIONS}
        value={showCustom ? "custom" : value.preset}
        onChange={(key) => {
          if (key === "custom") {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          onChange({ preset: key, ...presetRange(key, today ?? jakartaTodayBrowser()) });
        }}
      />
      {showCustom ? (
        <CustomRangeFields
          key={`${value.start_date}_${value.end_date}`}
          start={value.start_date}
          end={value.end_date}
          onApply={(range) => onChange({ preset: "custom", ...range })}
        />
      ) : null}
    </div>
  );
}

function CustomRangeFields(props: { start: string; end: string; onApply: (range: { start_date: string; end_date: string }) => void }) {
  const form = useForm({
    defaultValues: { start_date: props.start, end_date: props.end },
    validators: { onChange: customRangeSchema },
    onSubmit: ({ value }) => props.onApply(value),
  });

  // No <form>: the sandbox blocks submission, so the button and Enter submit explicitly.
  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void form.handleSubmit();
    }
  }

  const inputClass = "h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg";

  return (
    <div role="group" aria-label="Pilih rentang tanggal" className="flex flex-wrap items-end gap-2">
      <form.Field name="start_date">
        {(field) => (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">Dari</span>
            <input
              type="date"
              className={inputClass}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              onKeyDown={submitOnEnter}
            />
            <FieldError errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <form.Field name="end_date">
        {(field) => (
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-fg-muted">Sampai</span>
            <input
              type="date"
              className={inputClass}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              onKeyDown={submitOnEnter}
            />
            <FieldError errors={field.state.meta.errors} />
          </label>
        )}
      </form.Field>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          void form.handleSubmit();
        }}
      >
        Terapkan
      </button>
    </div>
  );
}

function FieldError({ errors }: { errors: ReadonlyArray<unknown> }) {
  const message = errors
    .map((error) =>
      typeof error === "string" ? error : error && typeof error === "object" && "message" in error ? String(error.message) : "",
    )
    .find((text) => text !== "");
  if (!message) return null;
  return (
    <span role="alert" className="max-w-56 text-danger">
      {message}
    </span>
  );
}

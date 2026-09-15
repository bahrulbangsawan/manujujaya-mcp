import { formatNumber } from "../lib/format";
import { cx } from "./ui";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface ChipGroupBase<T extends string> {
  /** Type the array as ChipOption<T>[] so T is the full union, not the first literal. */
  options: ReadonlyArray<ChipOption<T>>;
  /** Accessible name of the group, e.g. "Status". */
  label?: string;
}

export type ChipGroupProps<T extends string> = ChipGroupBase<T> &
  (
    | { multiple?: false; value: T; onChange: (value: T) => void }
    | { multiple: true; value: T[]; onChange: (value: T[]) => void }
  );

export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const selected = new Set<T>(props.multiple ? props.value : [props.value]);

  function choose(value: T) {
    if (props.multiple) {
      const next = new Set(selected);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      props.onChange(props.options.map((option) => option.value).filter((v) => next.has(v)));
    } else if (value !== props.value) {
      props.onChange(value);
    }
  }

  return (
    <div role="group" aria-label={props.label} className="flex flex-wrap gap-1.5">
      {props.options.map((option) => {
        const active = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => choose(option.value)}
            className={cx(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm",
              active ? "border-transparent bg-info-soft font-medium text-info" : "border-line text-fg hover:bg-surface-muted",
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className="tabular-nums opacity-75">{formatNumber(option.count, 0)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useEffect, useRef, useState } from "react";

export interface SearchInputProps {
  value: string;
  /** Called with the trimmed text once typing pauses for `debounceMs`, on Enter, or on clear. */
  onChange: (value: string) => void;
  placeholder: string;
  debounceMs?: number;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
}

export function SearchInput({ value, onChange, placeholder, debounceMs = 400, label }: SearchInputProps) {
  const [text, setText] = useState(value);
  const [debounced, debouncer] = useDebouncedValue(text, { wait: debounceMs });
  const emitted = useRef(value.trim());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // An outside change (navigation, reset) replaces the text without echoing it back.
  useEffect(() => {
    if (value.trim() !== emitted.current) {
      emitted.current = value.trim();
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    const next = debounced.trim();
    if (next !== emitted.current) {
      emitted.current = next;
      onChangeRef.current(next);
    }
  }, [debounced]);

  function clear() {
    debouncer.cancel();
    setText("");
    if (emitted.current !== "") {
      emitted.current = "";
      onChangeRef.current("");
    }
  }

  return (
    <div className="relative">
      <input
        type="search"
        enterKeyHint="search"
        maxLength={100}
        value={text}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            debouncer.flush();
          } else if (event.key === "Escape" && text !== "") {
            event.preventDefault();
            clear();
          }
        }}
        className="h-9 w-full rounded-md border border-line bg-surface pl-3 pr-16 text-sm text-fg placeholder:text-fg-subtle"
      />
      {text !== "" ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Hapus pencarian"
          className="absolute inset-y-1 right-1 rounded px-2 text-xs text-fg-muted hover:bg-surface-muted"
        >
          Hapus
        </button>
      ) : null}
    </div>
  );
}

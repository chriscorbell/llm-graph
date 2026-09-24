import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, CheckCheck, ChevronDown, RotateCcw, Search, X } from "lucide-react";
import type { Family } from "../lib/families.ts";
import type { SeriesColor } from "../lib/colors.ts";
import { CreatorMark } from "./CreatorMark.tsx";

interface Props {
  families: Family[];
  colors: Map<string, SeriesColor>;
  visible: Set<string>;
  defaultCount: number;
  /** Selection is exactly the default top models, so resetting would do nothing. */
  isDefault: boolean;
  onToggle: (id: string) => void;
  onReset: () => void;
  onClear: () => void;
  onSelectAll: () => void;
  onHighlight: (id: string | null) => void;
}

export function ModelPicker({ families, colors, visible, defaultCount, isDefault, onToggle, onReset, onClear, onSelectAll, onHighlight }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    const t = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 20);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      clearTimeout(t);
    };
  }, [open]);

  useEffect(() => {
    if (!open) onHighlight(null);
  }, [open, onHighlight]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) => f.name.toLowerCase().includes(q) || f.creator.name.toLowerCase().includes(q));
  }, [families, query]);

  const visibleCreators = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    for (const f of families) {
      if (visible.has(f.id) && !seen.has(f.creator.id)) {
        seen.set(f.creator.id, { name: f.creator.name, color: colors.get(f.id)!.creatorSwatch });
      }
    }
    return [...seen.entries()].slice(0, 4);
  }, [families, visible, colors]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const options = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[role=option]") ?? [])];
    if (options.length === 0) return;
    e.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) {
      (e.key === "ArrowDown" ? options[0] : options[options.length - 1]).focus();
    } else if (e.key === "ArrowUp" && index === 0) {
      searchRef.current?.focus();
    } else {
      options[Math.min(options.length - 1, index + (e.key === "ArrowDown" ? 1 : -1))].focus();
    }
  }

  return (
    <div className="picker" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="pill picker-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        {visibleCreators.length > 0 && (
          <span className="mark-stack" aria-hidden>
            {visibleCreators.map(([id, c]) => (
              <CreatorMark key={id} name={c.name} color={c.color} />
            ))}
          </span>
        )}
        <span className="picker-label">
          {visible.size} of {families.length}
          <span className="picker-noun"> models</span>
        </span>
        <ChevronDown size={16} strokeWidth={2} className="chevron" aria-hidden />
      </button>

      <div className="popover" data-open={open || undefined} role="dialog" aria-label="Choose models" inert={!open}>
        <label className="search">
          <Search size={16} strokeWidth={2} aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models or labs"
            aria-label="Search models or labs"
            spellCheck={false}
            autoComplete="off"
          />
          {query && (
            <button type="button" className="icon-button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </label>

        <div className="popover-head" aria-hidden>
          <span>Model</span>
          <span>Score</span>
        </div>

        <ul className="model-list" ref={listRef} role="listbox" aria-multiselectable onPointerLeave={() => onHighlight(null)}>
          {filtered.map((f) => {
            const checked = visible.has(f.id);
            const color = colors.get(f.id)!;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className="model-row"
                  onClick={() => onToggle(f.id)}
                  onPointerEnter={() => checked && onHighlight(f.id)}
                  onFocus={() => checked && onHighlight(f.id)}
                >
                  <span className="check" aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <CreatorMark name={f.creator.name} color={color.creatorSwatch} />
                  <span className="model-text">
                    <span className="model-name">{f.name}</span>
                    <span className="model-creator">{f.creator.name}</span>
                  </span>
                  <span className="model-score">{f.best.intelligence.toFixed(1)}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="no-results">No models match "{query}"</li>}
        </ul>

        <div className="popover-foot">
          <span className="selected-count">{visible.size} selected</span>
          <button
            type="button"
            className="pill-button"
            onClick={onSelectAll}
            disabled={visible.size === families.length}
          >
            <CheckCheck size={14} strokeWidth={2} aria-hidden />
            Select all
          </button>
          <button type="button" className="pill-button" onClick={onClear} disabled={visible.size === 0}>
            <X size={14} strokeWidth={2} aria-hidden />
            Clear
          </button>
          <button
            type="button"
            className="pill-button"
            onClick={onReset}
            disabled={isDefault}
            title={`Back to the top ${defaultCount} models`}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

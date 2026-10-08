import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Check, CheckCheck, RotateCcw, Search, X } from "lucide-react";
import type { Family } from "../lib/families.ts";
import type { SeriesColor } from "../lib/colors.ts";
import { CreatorMark } from "./CreatorMark.tsx";

export interface ModelSelection {
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
  /** Families on the Pareto frontier; the other shown ones fade back. Null when the frontier is off. */
  frontierFamilies: Set<string> | null;
}

interface Props extends ModelSelection {
  searchRef?: RefObject<HTMLInputElement | null>;
  /** Pressing "/" anywhere on the page focuses the search. */
  shortcut?: boolean;
}

/** Search, model list and bulk actions, shared by the header menu and the sidebar. */
export function ModelPanel({
  families,
  colors,
  visible,
  defaultCount,
  isDefault,
  onToggle,
  onReset,
  onClear,
  onSelectAll,
  onHighlight,
  frontierFamilies,
  searchRef,
  shortcut = false,
}: Props) {
  const [query, setQuery] = useState("");
  const ownSearchRef = useRef<HTMLInputElement>(null);
  const search = searchRef ?? ownSearchRef;
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
      // Hidden at widths where the header menu takes over.
      if (!search.current || search.current.offsetParent === null) return;
      e.preventDefault();
      search.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, search]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) => f.name.toLowerCase().includes(q) || f.creator.name.toLowerCase().includes(q));
  }, [families, query]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && e.target === search.current && query) {
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
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
      search.current?.focus();
    } else {
      options[Math.min(options.length - 1, index + (e.key === "ArrowDown" ? 1 : -1))].focus();
    }
  }

  return (
    <div className="panel" onKeyDown={onKeyDown}>
      <label className="search">
        <Search size={16} strokeWidth={2} aria-hidden />
        <input
          ref={search}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models or labs"
          aria-label="Search models or labs"
          spellCheck={false}
          autoComplete="off"
        />
        {query ? (
          <button type="button" className="icon-button" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={14} strokeWidth={2} />
          </button>
        ) : (
          shortcut && (
            <kbd className="search-key" aria-hidden>
              /
            </kbd>
          )
        )}
      </label>

      <div className="panel-head" aria-hidden>
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
                data-off-frontier={checked && frontierFamilies && !frontierFamilies.has(f.id) ? "" : undefined}
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

      <div className="panel-foot">
        <span className="selected-count">{visible.size} selected</span>
        <button type="button" className="pill-button" onClick={onSelectAll} disabled={visible.size === families.length}>
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
          title={`Back to the top ${defaultCount} current models`}
        >
          <RotateCcw size={14} strokeWidth={2} aria-hidden />
          Reset
        </button>
      </div>
    </div>
  );
}

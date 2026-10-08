import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { CreatorMark } from "./CreatorMark.tsx";
import { ModelPanel, type ModelSelection } from "./ModelPanel.tsx";

/** Header menu for choosing models, used where the window is too narrow for the sidebar. */
export function ModelPicker(props: ModelSelection) {
  const { families, colors, visible, onHighlight } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
    if (e.key !== "Escape") return;
    e.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
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
        <ModelPanel {...props} searchRef={searchRef} />
      </div>
    </div>
  );
}

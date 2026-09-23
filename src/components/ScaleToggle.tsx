import type { ScaleMode } from "./Chart.tsx";

const OPTIONS: { value: ScaleMode; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "log", label: "Log" },
];

export function ScaleToggle({ value, onChange }: { value: ScaleMode; onChange: (v: ScaleMode) => void }) {
  return (
    <div className="pill segmented" role="radiogroup" aria-label="Cost axis scale" data-value={value}>
      <span className="segmented-thumb" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const next = OPTIONS[(OPTIONS.findIndex((x) => x.value === value) + 1) % OPTIONS.length];
              onChange(next.value);
              (e.currentTarget.parentElement?.querySelector(`[aria-checked="false"]`) as HTMLElement | null)?.focus();
            }
          }}
          tabIndex={value === o.value ? 0 : -1}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

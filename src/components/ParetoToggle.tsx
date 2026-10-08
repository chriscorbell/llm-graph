import { Spline } from "lucide-react";

export function ParetoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="pill toggle"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      title="Trace the best score available at each cost"
    >
      <span className="toggle-face">
        <Spline size={15} strokeWidth={2} aria-hidden />
        Pareto
      </span>
    </button>
  );
}

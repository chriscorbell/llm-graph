import { useCallback, useEffect, useMemo, useState } from "react";
import data from "./data/models.json";
import type { Dataset } from "./lib/types.ts";
import { EFFORT_LABEL, groupFamilies } from "./lib/families.ts";
import { assignColors } from "./lib/colors.ts";
import { formatCost, formatDateTime } from "./lib/format.ts";
import { Chart, type ScaleMode } from "./components/Chart.tsx";
import { ModelPicker } from "./components/ModelPicker.tsx";
import { ScaleToggle } from "./components/ScaleToggle.tsx";

const DEFAULT_COUNT = 10;
const PREFS_KEY = "llm-graph:prefs";

interface Prefs {
  scale: ScaleMode;
  /** "top" shows the highest scorers by default; "none" starts from an empty chart. */
  base: "top" | "none";
  /** Explicit show/hide choices layered on top of the base, so new top models still appear. */
  overrides: Record<string, boolean>;
}

const DEFAULT_PREFS: Prefs = { scale: "linear", base: "top", overrides: {} };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // storage unavailable or corrupt
  }
  return DEFAULT_PREFS;
}

const dataset = data as Dataset;

export default function App() {
  const families = useMemo(() => groupFamilies(dataset.models), []);
  const colors = useMemo(() => assignColors(families), [families]);
  const topIds = useMemo(() => new Set(families.slice(0, DEFAULT_COUNT).map((f) => f.id)), [families]);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  const isDefault = useCallback(
    (id: string, base: Prefs["base"]) => base === "top" && topIds.has(id),
    [topIds],
  );

  const visibleIds = useMemo(
    () => new Set(families.filter((f) => prefs.overrides[f.id] ?? isDefault(f.id, prefs.base)).map((f) => f.id)),
    [families, prefs.overrides, prefs.base, isDefault],
  );
  const visible = useMemo(() => families.filter((f) => visibleIds.has(f.id)), [families, visibleIds]);

  const toggle = useCallback(
    (id: string) =>
      setPrefs((p) => {
        const next = !(p.overrides[id] ?? isDefault(id, p.base));
        const overrides = { ...p.overrides };
        if (next === isDefault(id, p.base)) delete overrides[id];
        else overrides[id] = next;
        return { ...p, overrides };
      }),
    [isDefault],
  );
  const reset = useCallback(() => setPrefs((p) => ({ ...p, base: "top", overrides: {} })), []);
  const clear = useCallback(() => setPrefs((p) => ({ ...p, base: "none", overrides: {} })), []);

  return (
    <main className="page">
      <header className="bar">
        <h1>Model Index</h1>
        <div className="controls">
          <ModelPicker
            families={families}
            colors={colors}
            visible={visibleIds}
            defaultCount={DEFAULT_COUNT}
            onToggle={toggle}
            onReset={reset}
            onClear={clear}
            onHighlight={setHighlight}
          />
          <ScaleToggle value={prefs.scale} onChange={(scale) => setPrefs((p) => ({ ...p, scale }))} />
        </div>
      </header>

      <Chart families={visible} colors={colors} scale={prefs.scale} highlight={highlight} onReset={reset} />

      <footer className="foot">
        <p>Each dot is a specific reasoning effort level. Dashed lines represent older models.</p>
        <p>
          Data from{" "}
          <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer">
            Artificial Analysis
          </a>
          , updated {formatDateTime(dataset.fetchedAt)}
        </p>
      </footer>

      <table className="sr-only">
        <caption>Selected models by reasoning effort</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Effort</th>
            <th scope="col">Intelligence Index</th>
            <th scope="col">Cost per task</th>
          </tr>
        </thead>
        <tbody>
          {visible.flatMap((f) =>
            f.variants.map((v) => (
              <tr key={v.id}>
                <th scope="row">{f.name}</th>
                <td>{v.effort ? EFFORT_LABEL[v.effort] : "Default"}</td>
                <td>{v.intelligence.toFixed(1)}</td>
                <td>{formatCost(v.costPerTask)}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import data from "./data/models.json";
import type { Dataset } from "./lib/types.ts";
import { EFFORT_LABEL, groupFamilies } from "./lib/families.ts";
import { assignColors } from "./lib/colors.ts";
import { paretoFrontier } from "./lib/pareto.ts";
import { formatCost, formatDateTime } from "./lib/format.ts";
import { Chart, type ScaleMode } from "./components/Chart.tsx";
import { ModelPicker } from "./components/ModelPicker.tsx";
import { ModelPanel, type ModelSelection } from "./components/ModelPanel.tsx";
import { ScaleToggle } from "./components/ScaleToggle.tsx";
import { ParetoToggle } from "./components/ParetoToggle.tsx";

const DEFAULT_COUNT = 10;
const PREFS_KEY = "llm-graph:prefs";

interface Prefs {
  scale: ScaleMode;
  /** Trace the Pareto frontier across the visible models. */
  pareto: boolean;
  /** "top" shows the highest-scoring current models by default; "all" and "none" start from everything or nothing. */
  base: "top" | "all" | "none";
  /** Explicit show/hide choices layered on top of the base, so new top models still appear. */
  overrides: Record<string, boolean>;
}

const DEFAULT_PREFS: Prefs = { scale: "linear", pareto: false, base: "top", overrides: {} };

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
  const topIds = useMemo(
    () => new Set(families.filter((f) => !f.superseded).slice(0, DEFAULT_COUNT).map((f) => f.id)),
    [families],
  );

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
    (id: string, base: Prefs["base"]) => base === "all" || (base === "top" && topIds.has(id)),
    [topIds],
  );

  const visibleIds = useMemo(
    () => new Set(families.filter((f) => prefs.overrides[f.id] ?? isDefault(f.id, prefs.base)).map((f) => f.id)),
    [families, prefs.overrides, prefs.base, isDefault],
  );
  const visible = useMemo(() => families.filter((f) => visibleIds.has(f.id)), [families, visibleIds]);
  const frontier = useMemo(
    () => (prefs.pareto ? paretoFrontier(visible.flatMap((f) => f.variants)) : []),
    [visible, prefs.pareto],
  );
  const frontierIds = new Set(frontier.map((v) => v.id));
  const frontierFamilies = prefs.pareto
    ? new Set(visible.filter((f) => f.variants.some((v) => frontierIds.has(v.id))).map((f) => f.id))
    : null;

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
  const selectAll = useCallback(() => setPrefs((p) => ({ ...p, base: "all", overrides: {} })), []);

  const selection: ModelSelection = {
    families,
    colors,
    visible: visibleIds,
    defaultCount: DEFAULT_COUNT,
    isDefault: prefs.base === "top" && Object.keys(prefs.overrides).length === 0,
    onToggle: toggle,
    onReset: reset,
    onClear: clear,
    onSelectAll: selectAll,
    onHighlight: setHighlight,
    frontierFamilies,
  };

  return (
    <div className="app">
      <main className="page">
        <header className="bar">
          <h1>Model Index</h1>
          <div className="controls">
            <ModelPicker {...selection} />
            <ParetoToggle value={prefs.pareto} onChange={(pareto) => setPrefs((p) => ({ ...p, pareto }))} />
            <ScaleToggle value={prefs.scale} onChange={(scale) => setPrefs((p) => ({ ...p, scale }))} />
          </div>
        </header>

        <Chart
          families={visible}
          colors={colors}
          scale={prefs.scale}
          frontier={frontier}
          frontierFamilies={frontierFamilies}
          highlight={highlight}
          onReset={reset}
        />

        <footer className="foot">
          <p>
            Each dot is a specific reasoning effort level. Dashed lines represent older models.
            {prefs.pareto && " The white dashed line traces the Pareto frontier."}
          </p>
          <p>
            Data from{" "}
            <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer">
              Artificial Analysis
            </a>
            , updated {formatDateTime(dataset.fetchedAt)}
          </p>
        </footer>

        {/* Tables ignore width/height/overflow, so the visually-hidden wrapper does the clipping. */}
        <div className="sr-only">
          <table>
            <caption>Selected models by reasoning effort</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Effort</th>
                <th scope="col">Intelligence Index</th>
                <th scope="col">Cost per task</th>
                {prefs.pareto && <th scope="col">On Pareto frontier</th>}
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
                    {prefs.pareto && <td>{frontierIds.has(v.id) ? "Yes" : "No"}</td>}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </main>

      <aside className="sidebar" aria-label="Models">
        <div className="sidebar-head">
          <h2>Models</h2>
          <span className="sidebar-count">
            {visibleIds.size} of {families.length}
          </span>
        </div>
        <ModelPanel {...selection} shortcut />
      </aside>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { scaleLinear } from "d3-scale";
import { RotateCcw } from "lucide-react";
import { EFFORT_LABEL, type Family, type Variant } from "../lib/families.ts";
import type { SeriesColor } from "../lib/colors.ts";
import { stackLabels, type Point } from "../lib/labels.ts";
import { useFontsReady, useGlide, usePresence, useSize, useTween } from "../lib/hooks.ts";
import { formatCost, formatLogTick, formatPrice, formatTick, formatWhole } from "../lib/format.ts";
import { CreatorMark } from "./CreatorMark.tsx";

export type ScaleMode = "linear" | "log";

interface Props {
  families: Family[];
  colors: Map<string, SeriesColor>;
  scale: ScaleMode;
  /** Pareto-optimal variants, cheapest first. Empty when the frontier is off. */
  frontier: Variant[];
  /** Families with a variant on the frontier. Null when the frontier is off. */
  frontierFamilies: Set<string> | null;
  highlight: string | null;
  onReset: () => void;
}

const LABEL_FONT = '550 13px "Geist Variable", system-ui, sans-serif';
/** Label column: preferred and tightest spacing between label centers. */
const LABEL_ROW = 22;
const LABEL_ROW_MIN = 17;
const LABEL_MARK = 14;
/** Longer names are cut off with an ellipsis. */
const LABEL_MAX_WIDTH = 180;
/** Room between the plot and the label column for leader lines to bend. */
const BEND = 30;
/** Narrower charts list the models in a legend below instead. */
const COLUMN_MIN_WIDTH = 720;
const HOVER_RADIUS = 40;
const TIP_WIDTH = 236;
/** Approximate advance of a 12px Geist Mono character, for keeping tick labels in bounds. */
const TICK_CHAR_WIDTH = 7.3;

interface Domain {
  lin: [number, number];
  /** log10 of the cost bounds */
  log: [number, number];
  y: [number, number];
}

function targetDomain(families: Family[]): Domain {
  const variants = families.flatMap((f) => f.variants);
  if (variants.length === 0) return { lin: [0, 8], log: [-3, 1], y: [0, 60] };
  const costs = variants.map((v) => v.costPerTask);
  const max = Math.max(...costs) || 1;
  const positive = costs.filter((c) => c > 0);
  const min = positive.length ? Math.min(...positive) : max / 100;
  const scores = variants.map((v) => v.intelligence);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const pad = Math.max(2.5, (hi - lo) * 0.08);
  return {
    lin: [0, scaleLinear().domain([0, max * 1.04]).nice(8).domain()[1]],
    log: [Math.log10(min / 1.6), Math.log10(max * 1.6)],
    y: [Math.max(0, lo - pad), hi + pad],
  };
}

function logTicks([a, b]: [number, number], maxCount: number): number[] {
  const all: { v: number; major: boolean }[] = [];
  for (let e = Math.floor(a); e <= Math.ceil(b); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      const lv = Math.log10(v);
      if (lv >= a - 1e-9 && lv <= b + 1e-9) all.push({ v: Number(v.toPrecision(3)), major: m === 1 });
    }
  }
  const picked = all.length > maxCount ? all.filter((t) => t.major) : all;
  return picked.map((t) => t.v);
}

type Mapper = (cost: number, score: number) => Point;

function makeMapper(
  [lin0, lin1, log0, log1, y0, y1, mix]: number[],
  plot: { left: number; top: number; width: number; height: number },
): Mapper {
  return (cost, score) => {
    const linX = (cost - lin0) / (lin1 - lin0);
    const logX = (Math.log10(Math.max(cost, 10 ** log0)) - log0) / (log1 - log0);
    return {
      x: plot.left + (linX + (logX - linX) * mix) * plot.width,
      y: plot.top + (1 - (score - y0) / (y1 - y0)) * plot.height,
    };
  };
}

const linePath = (pts: Point[]) => pts.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

/** Beside the point when there's room, otherwise above or below it (narrow screens). */
function tooltipPlacement(p: Point, width: number, height: number) {
  const vertical = Math.min(Math.max(p.y, 90), height - 90);
  if (p.x + 16 + TIP_WIDTH <= width) return { side: "right", x: p.x + 16, y: vertical };
  if (p.x - 16 - TIP_WIDTH >= 0) return { side: "left", x: p.x - 16 - TIP_WIDTH, y: vertical };
  const x = Math.min(Math.max(p.x - TIP_WIDTH / 2, 0), width - TIP_WIDTH);
  return p.y > height / 2 ? { side: "above", x, y: p.y - 16 } : { side: "below", x, y: p.y + 16 };
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 7;
  measureCtx.font = LABEL_FONT;
  return Math.ceil(measureCtx.measureText(text).width);
}

export function Chart({ families, colors, scale, frontier, frontierFamilies, highlight, onReset }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(wrapRef);
  const fontsReady = useFontsReady();
  const [hover, setHover] = useState<{ family: Family; index: number } | null>(null);
  const [labelHover, setLabelHover] = useState<string | null>(null);

  const narrow = width < 640;
  const column = width >= COLUMN_MIN_WIDTH && families.length > 0;
  const gutter = useMemo(() => {
    const widest = Math.max(0, ...families.map((f) => measure(f.name)));
    return BEND + LABEL_MARK + 7 + Math.min(widest, LABEL_MAX_WIDTH) + 8;
  }, [families, fontsReady]);

  const domain = useMemo(() => targetDomain(families), [families]);
  // The right margin rides along so the plot resizes smoothly as the label column grows or shrinks.
  const target = [...domain.lin, ...domain.log, ...domain.y, scale === "log" ? 1 : 0, column ? gutter : narrow ? 12 : 20];
  // The first measured frame lands in place instead of animating in from zero width.
  const lastWidth = useRef(0);
  useEffect(() => {
    lastWidth.current = width;
  });
  const current = useTween(target, 700, lastWidth.current === 0);

  const margin = { top: 40, right: current[7], bottom: 62, left: narrow ? 38 : 48 };
  const plot = {
    left: margin.left,
    top: margin.top,
    width: Math.max(0, width - margin.left - margin.right),
    height: Math.max(0, height - margin.top - margin.bottom),
  };
  const map = makeMapper(current, plot);

  const series = usePresence(families);
  // Stagger the entrance only on first load; later toggles animate immediately.
  const mountedAt = useRef(performance.now());
  const stagger = (i: number) => (performance.now() - mountedAt.current < 1500 ? i : 0);

  // Keyed by its points, so a changed frontier draws in fresh while the old one fades out.
  const frontierPaths = usePresence(frontier.length > 1 ? [{ id: frontier.map((v) => v.id).join("|"), points: frontier }] : []);

  const xTickCount = Math.max(3, Math.round(plot.width / 110));
  const linTicks = scaleLinear().domain(domain.lin).ticks(xTickCount);
  const linStep = linTicks.length > 1 ? linTicks[1] - linTicks[0] : 1;
  const logTickValues = logTicks(domain.log, Math.max(4, Math.round(plot.width / 70)));
  const yTicks = scaleLinear().domain(domain.y).ticks(Math.max(3, Math.round(plot.height / 90)));
  const mix = current[6];
  // Edge labels shift inward rather than running off the side of the chart.
  const tickX = (x: number, label: string) => {
    const half = (label.length * TICK_CHAR_WIDTH) / 2 + 2;
    return Math.min(Math.max(x, half), width - half);
  };

  // Column labels line up with their line's end dot and spread apart where they'd collide.
  // When there are too many to fit, the highest-scoring models keep theirs.
  const endPoint = (f: Family) => {
    const v = f.variants[f.variants.length - 1];
    return map(v.costPerTask, v.intelligence);
  };
  const labelTop = 12;
  const labelBottom = plot.top + plot.height - 6;
  const labeled = column ? families.slice(0, Math.floor((labelBottom - labelTop) / LABEL_ROW_MIN) + 1) : [];
  const ends = labeled.map(endPoint);
  const row = Math.max(LABEL_ROW_MIN, Math.min(LABEL_ROW, (labelBottom - labelTop) / Math.max(1, labeled.length - 1)));
  const stacked = stackLabels(ends.map((p) => p.y), row, labelTop, labelBottom);
  // Offsets from the end dots glide, so labels pushed aside by a newcomer move instead of jumping.
  const offsets = useGlide(new Map(labeled.map((f, k) => [f.id, stacked[k] - ends[k].y])));
  const labeledIds = new Set(labeled.map((f) => f.id));
  const plotRight = plot.left + plot.width;
  const labelX = plotRight + BEND;
  const columnLabels = column
    ? series.flatMap(({ item: f, exiting }, i) => {
        const offset = offsets.get(f.id);
        if (offset === undefined || (!exiting && !labeledIds.has(f.id))) return [];
        const end = endPoint(f);
        return [{ f, exiting, i, end, y: end.y + offset }];
      })
    : [];

  const labelFocus = labelHover && families.some((f) => f.id === labelHover) ? labelHover : null;
  const focus = hover?.family.id ?? labelFocus ?? highlight;
  const offFrontier = (id: string) => frontierFamilies !== null && !frontierFamilies.has(id);
  const seriesClass = (base: string, id: string, exiting = false) =>
    `${base}${exiting ? " exiting" : ""}${focus === id ? " is-focus" : ""}${offFrontier(id) ? " off-frontier" : ""}`;

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    let found: { family: Family; index: number } | null = null;
    let nearest = HOVER_RADIUS;
    for (const { item: f, exiting } of series) {
      if (exiting) continue;
      for (const [index, v] of f.variants.entries()) {
        const p = map(v.costPerTask, v.intelligence);
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < nearest) {
          nearest = d;
          found = { family: f, index };
        }
      }
    }
    if (!found) {
      if (hover) setHover(null);
    } else if (hover?.family.id !== found.family.id || hover.index !== found.index) {
      setHover(found);
    }
  }

  const hovered = hover && families.some((f) => f.id === hover.family.id) ? hover : null;
  const hoveredVariant = hovered ? hovered.family.variants[hovered.index] : null;
  const hoveredPoint = hoveredVariant ? map(hoveredVariant.costPerTask, hoveredVariant.intelligence) : null;
  const tip = hoveredPoint && tooltipPlacement(hoveredPoint, width, height);

  return (
    <>
      <div className="chart" ref={wrapRef} data-focus={focus ? "" : undefined}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="chart-svg"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}
            role="img"
            aria-label="Intelligence Index versus cost per task for the selected models"
          >
            <defs>
              <clipPath id="plot-clip">
                <rect x={plot.left - 10} y={plot.top - 40} width={plot.width + 20} height={plot.height + 50} />
              </clipPath>
              <clipPath id="axis-clip">
                <rect x={plot.left - 30} y={0} width={plot.width + 60} height={height} />
              </clipPath>
            </defs>

            <g className="grid">
              {yTicks.map((t) => {
                const y = map(0, t).y;
                return (
                  <g key={`y${t}`} className="tick-in">
                    <line x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} />
                    <text x={plot.left - 10} y={y} dy="0.32em" textAnchor="end" className="tick">
                      {t}
                    </text>
                  </g>
                );
              })}
              <g clipPath="url(#axis-clip)">
                {mix < 0.99 &&
                  linTicks.map((t) => {
                    const x = map(t, 0).x;
                    return (
                      <g key={`l${t}`} className="tick-in" opacity={1 - mix}>
                        <line x1={x} x2={x} y1={plot.top} y2={plot.top + plot.height} />
                        <text x={tickX(x, formatTick(t, linStep))} y={plot.top + plot.height + 22} textAnchor="middle" className="tick">
                          {formatTick(t, linStep)}
                        </text>
                      </g>
                    );
                  })}
                {mix > 0.01 &&
                  logTickValues.map((t) => {
                    const x = map(t, 0).x;
                    return (
                      <g key={`g${t}`} className="tick-in" opacity={mix}>
                        <line x1={x} x2={x} y1={plot.top} y2={plot.top + plot.height} />
                        <text x={tickX(x, formatLogTick(t))} y={plot.top + plot.height + 22} textAnchor="middle" className="tick">
                          {formatLogTick(t)}
                        </text>
                      </g>
                    );
                  })}
              </g>
              <rect className="frame" x={plot.left} y={plot.top} width={plot.width} height={plot.height} />
            </g>

            <text className="axis-title" x={plot.left} y={plot.top - 18}>
              Intelligence score <tspan className="axis-note">(multi-benchmark aggregation)</tspan>
            </text>
            <text className="axis-title" x={plot.left + plot.width / 2} y={height - 10} textAnchor="middle">
              Average cost per task <tspan className="axis-note">(USD)</tspan>
            </text>

            <g className="leaders">
              {columnLabels.map(({ f, exiting, i, end, y }) => (
                <path
                  key={f.id}
                  className={seriesClass("leader", f.id, exiting)}
                  d={`M${end.x.toFixed(1)},${end.y.toFixed(1)}H${plotRight + 4}L${labelX - 12},${y.toFixed(1)}H${labelX - 5}`}
                  style={{ "--i": stagger(i), "--c": colors.get(f.id)?.label } as CSSProperties}
                />
              ))}
            </g>

            <g clipPath="url(#plot-clip)">
              {frontierPaths.map(({ item, exiting }) => (
                <path
                  key={item.id}
                  className={`frontier${exiting ? " exiting" : ""}`}
                  d={linePath(item.points.map((v) => map(v.costPerTask, v.intelligence)))}
                  pathLength={1}
                />
              ))}
              {series.map(({ item: f, exiting }, i) => {
                const color = colors.get(f.id);
                if (!color) return null;
                const pts = f.variants.map((v) => map(v.costPerTask, v.intelligence));
                const d = linePath(pts);
                return (
                  <g
                    key={f.id}
                    className={seriesClass("series", f.id, exiting)}
                    style={{ "--i": stagger(i), "--c": color.stroke } as CSSProperties}
                  >
                    {pts.length > 1 &&
                      (f.superseded ? (
                        <path d={d} className="line dashed" />
                      ) : (
                        <path d={d} className="line drawn" pathLength={1} />
                      ))}
                    {pts.map((p, j) => {
                      const end = j === pts.length - 1;
                      const active = hovered?.family.id === f.id && hovered.index === j;
                      return (
                        <circle
                          key={j}
                          cx={p.x}
                          cy={p.y}
                          r={active ? 7 : end ? 5.5 : 4}
                          className={`dot${end ? " end" : ""}${active ? " active" : ""}`}
                          style={{ "--j": j } as CSSProperties}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {column && width > 0 && (
          <div className="col-labels" aria-hidden>
            {columnLabels.map(({ f, exiting, i, y }) => (
              <div
                key={f.id}
                className={seriesClass("col-label", f.id, exiting)}
                style={{ transform: `translate(${labelX}px, ${y}px)`, "--i": stagger(i), "--c": colors.get(f.id)?.label } as CSSProperties}
                onPointerEnter={() => setLabelHover(f.id)}
                onPointerLeave={() => setLabelHover(null)}
              >
                <CreatorMark name={f.creator.name} color={colors.get(f.id)?.creatorSwatch ?? "var(--text)"} size={LABEL_MARK} />
                <span className="col-label-name" style={{ maxWidth: LABEL_MAX_WIDTH }}>
                  {f.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {hovered && hoveredVariant && tip && (
          <div className="tooltip" data-side={tip.side} style={{ transform: `translate(${tip.x}px, ${tip.y}px)` }} aria-hidden>
            <div className="tooltip-inner">
              <div className="tooltip-head">
                <span className="swatch" style={{ background: colors.get(hovered.family.id)?.stroke }} />
                <div>
                  <div className="tooltip-name">{hovered.family.name}</div>
                  <div className="tooltip-sub">
                    {hoveredVariant.effort ? `${EFFORT_LABEL[hoveredVariant.effort]} effort` : hovered.family.creator.name}
                  </div>
                </div>
              </div>
              <div className="tooltip-rows">
                <span className="value">{hoveredVariant.intelligence.toFixed(1)}</span>
                <span className="key">Intelligence Index</span>
                <span className="value">{formatCost(hoveredVariant.costPerTask)}</span>
                <span className="key">Cost per task</span>
                {hoveredVariant.indexCost !== null && (
                  <>
                    <span className="value">{formatWhole(hoveredVariant.indexCost)}</span>
                    <span className="key">Full index run</span>
                  </>
                )}
                {hoveredVariant.priceInput !== null && hoveredVariant.priceOutput !== null && (
                  <>
                    <span className="value">
                      {formatPrice(hoveredVariant.priceInput)} / {formatPrice(hoveredVariant.priceOutput)}
                    </span>
                    <span className="key">Per 1M in / out</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {families.length === 0 && (
          <div className="empty">
            <p>No models selected</p>
            <button type="button" className="pill-button" onClick={onReset}>
              <RotateCcw size={14} strokeWidth={2} aria-hidden />
              Show top 10
            </button>
          </div>
        )}
      </div>

      {!column && width > 0 && families.length > 0 && (
        <ul className="legend" data-focus={focus ? "" : undefined} aria-hidden>
          {families.map((f) => (
            <li
              key={f.id}
              className={seriesClass("legend-item", f.id)}
              style={{ "--c": colors.get(f.id)?.label } as CSSProperties}
              onPointerEnter={() => setLabelHover(f.id)}
              onPointerLeave={() => setLabelHover(null)}
            >
              <CreatorMark name={f.creator.name} color={colors.get(f.id)?.creatorSwatch ?? "var(--text)"} size={LABEL_MARK} />
              <span className="legend-name">{f.name}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

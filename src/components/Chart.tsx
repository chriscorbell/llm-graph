import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { scaleLinear } from "d3-scale";
import { EFFORT_LABEL, type Family } from "../lib/families.ts";
import type { SeriesColor } from "../lib/colors.ts";
import { placeLabels, type Point } from "../lib/labels.ts";
import { useFontsReady, usePresence, useSize, useTween } from "../lib/hooks.ts";
import { formatCost, formatLogTick, formatPrice, formatTick, formatWhole } from "../lib/format.ts";

export type ScaleMode = "linear" | "log";

interface Props {
  families: Family[];
  colors: Map<string, SeriesColor>;
  scale: ScaleMode;
  highlight: string | null;
  onReset: () => void;
}

const LABEL_FONT = '500 13px "Geist Variable", system-ui, sans-serif';
const LABEL_HEIGHT = 16;
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

export function Chart({ families, colors, scale, highlight, onReset }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(wrapRef);
  const fontsReady = useFontsReady();
  const [hover, setHover] = useState<{ family: Family; index: number } | null>(null);

  const narrow = width < 640;
  const margin = { top: 40, right: narrow ? 12 : 20, bottom: 62, left: narrow ? 38 : 48 };
  const plot = {
    left: margin.left,
    top: margin.top,
    width: Math.max(0, width - margin.left - margin.right),
    height: Math.max(0, height - margin.top - margin.bottom),
  };

  const domain = useMemo(() => targetDomain(families), [families]);
  const target = [...domain.lin, ...domain.log, ...domain.y, scale === "log" ? 1 : 0];
  const current = useTween(target);
  const map = makeMapper(current, plot);

  const series = usePresence(families);
  // Stagger the entrance only on first load; later toggles animate immediately.
  const mountedAt = useRef(performance.now());
  const stagger = (i: number) => (performance.now() - mountedAt.current < 1500 ? i : 0);

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

  // Label layout is solved once for the destination state, then rides along with the animation.
  const targetKey = target.join(",");
  const labels = useMemo(() => {
    if (plot.width === 0) return new Map<string, ReturnType<typeof placeLabels>[number]>();
    const final = makeMapper(target, plot);
    const dots: Point[] = [];
    const segments: [Point, Point][] = [];
    for (const f of families) {
      const pts = f.variants.map((v) => final(v.costPerTask, v.intelligence));
      dots.push(...pts);
      for (let i = 1; i < pts.length; i++) segments.push([pts[i - 1], pts[i]]);
    }
    const requests = families.map((f) => {
      const end = f.variants[f.variants.length - 1];
      return {
        id: f.id,
        anchor: final(end.costPerTask, end.intelligence),
        width: measure(f.name),
        height: LABEL_HEIGHT,
      };
    });
    const bounds = { x0: plot.left + 2, y0: plot.top - 30, x1: plot.left + plot.width - 2, y1: plot.top + plot.height - 2 };
    return new Map(placeLabels(requests, dots, segments, bounds).map((l) => [l.id, l]));
  }, [families, targetKey, plot.width, plot.height, plot.left, fontsReady]);

  const focus = hover?.family.id ?? highlight;

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
    <div className="chart" ref={wrapRef}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="chart-svg"
          data-focus={focus ? "" : undefined}
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

          <g clipPath="url(#plot-clip)">
            {series.map(({ item: f, exiting }, i) => {
              const color = colors.get(f.id);
              if (!color) return null;
              const pts = f.variants.map((v) => map(v.costPerTask, v.intelligence));
              const d = pts.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
              const isFocus = focus === f.id;
              return (
                <g
                  key={f.id}
                  className={`series${exiting ? " exiting" : ""}${isFocus ? " is-focus" : ""}`}
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

          <g className="labels">
            {series.map(({ item: f, exiting }, i) => {
              const label = labels.get(f.id);
              const color = colors.get(f.id);
              if (!label || !color) return null;
              const end = f.variants[f.variants.length - 1];
              const a = map(end.costPerTask, end.intelligence);
              const leadX = Math.min(Math.max(0, label.dx), label.dx + label.width);
              const leadY = Math.min(Math.max(0, label.dy), label.dy + label.height);
              return (
                <g
                  key={f.id}
                  transform={`translate(${a.x},${a.y})`}
                  className={`label${exiting ? " exiting" : ""}${focus === f.id ? " is-focus" : ""}`}
                  style={{ "--i": stagger(i), "--c": color.label } as CSSProperties}
                >
                  {label.leader && <line className="leader" x1={0} y1={0} x2={leadX} y2={leadY} />}
                  <text className="label-text" style={{ transform: `translate(${label.dx}px, ${label.dy + 12}px)` }}>
                    {f.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
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
          <button type="button" className="text-button" onClick={onReset}>
            Show top 10
          </button>
        </div>
      )}
    </div>
  );
}

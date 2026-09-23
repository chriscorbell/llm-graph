import type { Family } from "./families.ts";

// Hue encodes the creator. Lightness steps separate a creator's product lines,
// and older versions reuse their line's step, a notch dimmer (and dashed in the chart).

interface Tone {
  l: number;
  c: number;
  h: number;
}

const BRAND: Record<string, Tone> = {
  anthropic: { l: 0.7, c: 0.15, h: 42 },
  openai: { l: 0.95, c: 0, h: 0 },
  google: { l: 0.68, c: 0.15, h: 255 },
};

// Remaining creators take these in order of their best model's score.
const POOL: Tone[] = [
  { l: 0.76, c: 0.13, h: 172 }, // aqua
  { l: 0.8, c: 0.15, h: 88 }, // yellow
  { l: 0.68, c: 0.18, h: 350 }, // magenta
  { l: 0.68, c: 0.15, h: 295 }, // violet
  { l: 0.74, c: 0.17, h: 142 }, // green
  { l: 0.66, c: 0.17, h: 20 }, // red
];

const STEPS = [0, 0.12, -0.13, 0.2, -0.2];
const NEUTRAL_STEPS = [0.95, 0.8, 0.66, 0.88, 0.58];

export interface SeriesColor {
  stroke: string;
  /** Same hue, lifted so text stays readable on the dark surface. */
  label: string;
  creatorSwatch: string;
}

export function assignColors(families: Family[]): Map<string, SeriesColor> {
  const creatorTone = new Map<string, Tone>();
  let pool = 0;
  // families arrive sorted by score, so creators are visited best-first
  for (const f of families) {
    if (creatorTone.has(f.creator.id)) continue;
    const brand = BRAND[f.creator.name.toLowerCase().replace(/\s+/g, "")];
    creatorTone.set(f.creator.id, brand ?? POOL[pool++ % POOL.length]);
  }

  const lineStep = new Map<string, number>();
  const linesPerCreator = new Map<string, number>();
  const colors = new Map<string, SeriesColor>();

  for (const f of families) {
    const tone = creatorTone.get(f.creator.id)!;
    const lineKey = `${f.creator.id}|${f.line}`;
    let step = lineStep.get(lineKey);
    if (step === undefined) {
      step = linesPerCreator.get(f.creator.id) ?? 0;
      linesPerCreator.set(f.creator.id, step + 1);
      lineStep.set(lineKey, step);
    }
    const i = step % STEPS.length;
    let l = tone.c === 0 ? NEUTRAL_STEPS[i] : clamp(tone.l + STEPS[i], 0.5, 0.92);
    let c = tone.c * (STEPS[i] > 0 ? 0.75 : 1);
    if (f.superseded) {
      l = clamp(l - 0.08, 0.45, 0.9);
      c *= 0.8;
    }
    colors.set(f.id, {
      stroke: oklchToHex(l, c, tone.h),
      label: oklchToHex(Math.max(l, 0.8), c, tone.h),
      creatorSwatch: oklchToHex(tone.l, tone.c, tone.h),
    });
  }
  return colors;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function oklchToHex(l: number, c: number, h: number): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    rgb
      .map((v) => {
        const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(clamp(g, 0, 1) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

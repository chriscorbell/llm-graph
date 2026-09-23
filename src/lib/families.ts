import type { Model } from "./types.ts";

// Artificial Analysis lists each reasoning-effort setting as its own model,
// e.g. "GPT-6 Astra (xhigh)" or "Claude Opus 5.5 (Adaptive Reasoning, Max
// Effort, Default Fallback)". A family is one model with all its effort levels.

export const EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export const EFFORT_LABEL: Record<Effort, string> = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

export interface Variant extends Model {
  effort: Effort | null;
}

export interface Family {
  /** Stable across data refreshes: creator id + normalized family name. */
  id: string;
  name: string;
  creator: { id: string; name: string };
  /** Ordered lowest to highest effort. */
  variants: Variant[];
  /** Highest-scoring variant. */
  best: Variant;
  releaseDate: string | null;
  /** Family name without version numbers, used to find newer versions. */
  line: string;
  /** A newer version of the same product line exists. */
  superseded: boolean;
}

const EFFORT_PART = /^(minimal|low|medium|high|x-?high|max)\b/i;
const TRAILING_PARENS = /\s*\(([^()]*)\)\s*$/;

export function parseName(name: string): { base: string; effort: Effort | null; qualifier: string | null } {
  const match = name.match(TRAILING_PARENS);
  if (!match) return { base: name.trim(), effort: null, qualifier: null };
  for (const part of match[1].split(",")) {
    const effort = part.trim().match(EFFORT_PART);
    if (effort) {
      const key = effort[1].toLowerCase().replace("-", "") as Effort;
      return { base: name.slice(0, match.index).trim(), effort: key, qualifier: null };
    }
  }
  // Non-effort qualifiers like "(Non-reasoning)" or "(Jan '25)" name a distinct model.
  return { base: name.trim(), effort: null, qualifier: match[1].trim() };
}

const SIZE_TOKEN = /^a?\d+(\.\d+)?[bmkt]$/i;

/** "GPT-5.6 Sol" and "GPT-6 Sol" share the line "gpt sol". Parameter sizes like 27B are kept. */
export function productLine(base: string, qualifier: string | null): string {
  const unqualified = base.replace(TRAILING_PARENS, "");
  const tokens = unqualified
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .map((t) => (SIZE_TOKEN.test(t) ? t : t.replace(/\d+(\.\d+)*/g, "").replace(/[^a-z0-9+]/g, "")))
    .filter((t) => t && t !== "preview");
  const nonReasoning = qualifier !== null && /non-?reasoning/i.test(qualifier);
  return tokens.join(" ") + (nonReasoning ? " (nr)" : "");
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

const effortRank = (e: Effort | null) => (e === null ? -1 : EFFORTS.indexOf(e));

export function groupFamilies(models: Model[]): Family[] {
  const groups = new Map<string, { base: string; qualifier: string | null; variants: Variant[] }>();

  for (const model of models) {
    const { base, effort, qualifier } = parseName(model.name);
    const id = `${model.creator.id}:${slugify(base)}`;
    let group = groups.get(id);
    if (!group) {
      group = { base, qualifier, variants: [] };
      groups.set(id, group);
    }
    group.variants.push({ ...model, effort });
  }

  const families: Family[] = [];
  for (const [id, { base, qualifier, variants }] of groups) {
    variants.sort((a, b) => effortRank(a.effort) - effortRank(b.effort) || a.costPerTask - b.costPerTask);
    const best = variants.reduce((a, b) => (b.intelligence > a.intelligence ? b : a));
    const releaseDate = variants.reduce<string | null>(
      (latest, v) => (v.releaseDate && (!latest || v.releaseDate > latest) ? v.releaseDate : latest),
      null,
    );
    families.push({
      id,
      name: base,
      creator: variants[0].creator,
      variants,
      best,
      releaseDate,
      line: productLine(base, qualifier),
      superseded: false,
    });
  }

  const newestByLine = new Map<string, string>();
  for (const f of families) {
    const key = `${f.creator.id}|${f.line}`;
    const newest = newestByLine.get(key);
    if (f.releaseDate && (!newest || f.releaseDate > newest)) newestByLine.set(key, f.releaseDate);
  }
  for (const f of families) {
    const newest = newestByLine.get(`${f.creator.id}|${f.line}`);
    f.superseded = !!(f.releaseDate && newest && newest > f.releaseDate);
  }

  return families.sort(
    (a, b) => b.best.intelligence - a.best.intelligence || a.best.costPerTask - b.best.costPerTask,
  );
}

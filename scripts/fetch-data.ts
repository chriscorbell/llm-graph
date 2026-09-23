// Pulls every LLM from the Artificial Analysis free API and writes the slim
// dataset the app bundles. The free tier allows 100 requests/day and the full
// list spans several pages, so local runs reuse a recent file unless --force.

import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Dataset, Model } from "../src/lib/types.ts";

const API = "https://artificialanalysis.ai/api/v2/language/models/free";
const OUT = resolve(import.meta.dirname, "../src/data/models.json");
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_PAGES = 20;

interface RawModel {
  id: string;
  name: string;
  slug: string;
  release_date?: string | null;
  model_creator: { id: string; name: string };
  evaluations?: { artificial_analysis_intelligence_index?: number | null };
  artificial_analysis_intelligence_index_cost?: {
    total_cost?: number | null;
    cost_per_task?: { total_cost?: number | null } | null;
  } | null;
  pricing?: {
    price_1m_input_tokens?: number | null;
    price_1m_output_tokens?: number | null;
  } | null;
  performance?: { median_output_tokens_per_second?: number | null } | null;
}

interface RawPage {
  intelligence_index_version?: number;
  pagination?: { page: number; total_pages: number; has_more: boolean };
  data: RawModel[];
}

const force = process.argv.includes("--force") || !!process.env.CI;

if (!force && existsSync(OUT) && Date.now() - statSync(OUT).mtimeMs < MAX_AGE_MS) {
  console.log("models.json is fresh, skipping fetch (use --force to refetch)");
  process.exit(0);
}

const key = process.env.AA_KEY;
if (!key) {
  if (existsSync(OUT)) {
    console.warn("AA_KEY not set, keeping existing models.json");
    process.exit(0);
  }
  console.error("AA_KEY is not set. Add it to .env or the environment.");
  process.exit(1);
}

async function fetchPage(page: number): Promise<RawPage> {
  const res = await fetch(`${API}?page=${page}`, { headers: { "x-api-key": key! } });
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (!res.ok) {
    const reset = res.headers.get("x-ratelimit-reset");
    const hint = res.status === 429 && reset ? ` (resets ${new Date(Number(reset) * 1000).toISOString()})` : "";
    throw new Error(`Artificial Analysis API returned ${res.status} for page ${page}${hint}`);
  }
  console.log(`page ${page} ok, ${remaining ?? "?"} requests left today`);
  return (await res.json()) as RawPage;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function slim(m: RawModel): Model | null {
  const intelligence = num(m.evaluations?.artificial_analysis_intelligence_index);
  const cost = m.artificial_analysis_intelligence_index_cost;
  const costPerTask = num(cost?.cost_per_task?.total_cost);
  if (intelligence === null || costPerTask === null || costPerTask < 0) return null;
  return {
    id: m.id,
    name: m.name.trim(),
    slug: m.slug,
    creator: { id: m.model_creator.id, name: m.model_creator.name },
    releaseDate: m.release_date ?? null,
    intelligence,
    costPerTask,
    indexCost: num(cost?.total_cost),
    priceInput: num(m.pricing?.price_1m_input_tokens),
    priceOutput: num(m.pricing?.price_1m_output_tokens),
    outputSpeed: num(m.performance?.median_output_tokens_per_second),
  };
}

const first = await fetchPage(1);
const pages = [first];
const total = Math.min(first.pagination?.total_pages ?? 1, MAX_PAGES);
for (let p = 2; p <= total; p++) pages.push(await fetchPage(p));

const raw = pages.flatMap((p) => p.data);
const models = raw.map(slim).filter((m): m is Model => m !== null);
if (models.length === 0) throw new Error("No plottable models in API response");

const dataset: Dataset = {
  fetchedAt: new Date().toISOString(),
  indexVersion: first.intelligence_index_version ?? null,
  models,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(dataset));
console.log(`wrote ${models.length} of ${raw.length} models to ${OUT}`);

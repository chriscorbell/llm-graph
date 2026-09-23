import { describe, expect, it } from "vitest";
import { groupFamilies, parseName, productLine } from "./families.ts";
import type { Model } from "./types.ts";

const creators = {
  anthropic: { id: "a", name: "Anthropic" },
  openai: { id: "o", name: "OpenAI" },
  alibaba: { id: "q", name: "Alibaba" },
};

let n = 0;
function model(name: string, creator: Model["creator"], intelligence: number, costPerTask: number, releaseDate: string): Model {
  return {
    id: `m${n++}`,
    name,
    slug: name.toLowerCase(),
    creator,
    releaseDate,
    intelligence,
    costPerTask,
    indexCost: null,
    priceInput: null,
    priceOutput: null,
    outputSpeed: null,
  };
}

describe("parseName", () => {
  it.each([
    ["GPT-6 Astra (xhigh)", "GPT-6 Astra", "xhigh"],
    ["Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)", "Claude Opus 5.5", "max"],
    ["DeepSeek V4.1 Flash (Reasoning, Max Effort)", "DeepSeek V4.1 Flash", "max"],
    ["Quasar 438B (max, based on GLM-5.2)", "Quasar 438B", "max"],
    ["Claude Opus 5.5 (max with fallback)", "Claude Opus 5.5", "max"],
  ])("reads the effort from %s", (name, base, effort) => {
    expect(parseName(name)).toMatchObject({ base, effort });
  });

  it.each(["GPT-6 Sol (Non-reasoning)", "Qwen3.8 Max (0902)", "DeepSeek R1 (Jan '25)", "Step 5 Preview"])(
    "keeps %s as its own model",
    (name) => {
      expect(parseName(name)).toMatchObject({ base: name, effort: null });
    },
  );
});

describe("productLine", () => {
  it("drops version numbers but keeps parameter sizes", () => {
    expect(productLine("GPT-5.6 Sol", null)).toBe(productLine("GPT-6 Sol", null));
    expect(productLine("Qwen3.8 Max (0902)", "0902")).toBe(productLine("Qwen3.7 Max", null));
    expect(productLine("Qwen3.8 27B", null)).not.toBe(productLine("Qwen3.8 35B", null));
    expect(productLine("GPT-6 Sol (Non-reasoning)", "Non-reasoning")).not.toBe(productLine("GPT-6 Sol", null));
  });
});

describe("groupFamilies", () => {
  const families = groupFamilies([
    model("GPT-6 Sol (max)", creators.openai, 47.5, 1.05, "2026-09-22"),
    model("GPT-6 Sol (low)", creators.openai, 33.9, 0.13, "2026-09-22"),
    model("GPT-6 Sol (high)", creators.openai, 42.8, 0.37, "2026-09-22"),
    model("GPT-6 Sol (Non-reasoning)", creators.openai, 28.1, 0.33, "2026-09-22"),
    model("GPT-5.6 Sol (max)", creators.openai, 47, 1.99, "2026-07-09"),
    model("Claude Opus 5.5 (Adaptive Reasoning, Max Effort, Default Fallback)", creators.anthropic, 57.6, 5.98, "2026-09-22"),
    model("Qwen3.8 Max (0902)", creators.alibaba, 45.4, 5.4, "2026-09-02"),
    model("Qwen3.8 Max", creators.alibaba, 40.2, 2.67, "2026-08-03"),
  ]);
  const byName = new Map(families.map((f) => [f.name, f]));

  it("merges effort levels into one family ordered low to max", () => {
    expect(byName.get("GPT-6 Sol")?.variants.map((v) => v.effort)).toEqual(["low", "high", "max"]);
  });

  it("keeps non-reasoning variants separate", () => {
    expect(byName.get("GPT-6 Sol (Non-reasoning)")?.variants).toHaveLength(1);
  });

  it("sorts families by their best score", () => {
    expect(families[0].name).toBe("Claude Opus 5.5");
  });

  it("marks older versions of a product line as superseded", () => {
    expect(byName.get("GPT-5.6 Sol")?.superseded).toBe(true);
    expect(byName.get("GPT-6 Sol")?.superseded).toBe(false);
    expect(byName.get("Qwen3.8 Max")?.superseded).toBe(true);
    expect(byName.get("Qwen3.8 Max (0902)")?.superseded).toBe(false);
  });

  it("gives families ids that survive name reordering", () => {
    expect(byName.get("GPT-6 Sol")?.id).toBe("o:gpt-6-sol");
  });
});

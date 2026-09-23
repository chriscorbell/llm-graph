/** One model entry as written by scripts/fetch-data.ts. */
export interface Model {
  id: string;
  name: string;
  slug: string;
  creator: { id: string; name: string };
  releaseDate: string | null;
  /** Artificial Analysis Intelligence Index. */
  intelligence: number;
  /** Weighted-average USD cost to complete one Intelligence Index task. */
  costPerTask: number;
  /** USD cost to run the full Intelligence Index. */
  indexCost: number | null;
  priceInput: number | null;
  priceOutput: number | null;
  outputSpeed: number | null;
}

export interface Dataset {
  fetchedAt: string;
  indexVersion: number | null;
  models: Model[];
}

export function formatCost(v: number): string {
  if (v === 0) return "$0";
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(4)}`;
}

export function formatPrice(v: number): string {
  return `$${Number(v.toFixed(2))}`;
}

export function formatWhole(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** Axis tick label; decimals follow the tick spacing so labels stay short. */
export function formatTick(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
  return `$${v.toFixed(decimals)}`;
}

export function formatLogTick(v: number): string {
  const decimals = v >= 1 ? 0 : Math.ceil(-Math.log10(v) - 1e-9);
  return `$${v.toFixed(decimals)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

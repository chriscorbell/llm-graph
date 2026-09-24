import { describe, expect, it } from "vitest";
import { formatLogTick, formatTick } from "./format.ts";

describe("axis ticks", () => {
  it("shows two decimals on the linear axis", () => {
    expect([0, 1, 5, 10].map((v) => formatTick(v, 1))).toEqual(["$0.00", "$1.00", "$5.00", "$10.00"]);
    expect([0, 0.2, 0.4].map((v) => formatTick(v, 0.2))).toEqual(["$0.00", "$0.20", "$0.40"]);
  });

  it("shows two decimals on the log axis", () => {
    expect([0.1, 0.2, 0.5, 1, 10].map(formatLogTick)).toEqual(["$0.10", "$0.20", "$0.50", "$1.00", "$10.00"]);
  });

  it("keeps sub-cent ticks distinct instead of rounding them to $0.00", () => {
    expect([0.001, 0.002, 0.005].map(formatLogTick)).toEqual(["$0.001", "$0.002", "$0.005"]);
    expect(formatTick(0.005, 0.005)).toBe("$0.005");
  });
});

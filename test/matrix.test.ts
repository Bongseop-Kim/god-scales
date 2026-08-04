import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("pairing matrix", () => {
  it("fills ten evenly stratified cells and computes within-pairing deltas", () => {
    const report = summarize(simulateStratified(200));
    expect(Object.values(report.runs_by_pairing)).toEqual(Array(10).fill(20));
    const cells = Object.entries(report.win_rate_matrix).flatMap(([left, row]) => Object.entries(row).filter(([right, value]) => left < right && value !== null));
    expect(cells).toHaveLength(10);
    expect(report.pairing_win_stddev).toBeLessThanOrEqual(0.08);
    expect(report.card_win_delta).toEqual(expect.any(Object));
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/engine";
import { summarize } from "../sim/report";
import { validateItems } from "../tools/validate";

describe("generated enemies", () => {
  it("rejects an encounter outside its regional thresholds", () => {
    const items = JSON.parse(readFileSync("staging/enemies-underworld.json", "utf8"));
    const report = validateItems(items);
    expect(report.rejected).toEqual([{ id: "enemy_bad_group", failure: "value_outlier" }]);
  });

  it("reports enemy counts, target spread, and efficient blocking", () => {
    const report = summarize(simulate(500));
    expect(report.enemy_count_dist).toEqual(expect.any(Object));
    expect(report.target_spread).toEqual(expect.any(Object));
    // 재동결 측정 (제우스+아테나 기본 조합) 0.585 — N-04 0.544에서 올랐다
    expect(report.block_efficiency).toBeGreaterThanOrEqual(0.52);
    expect(report.block_efficiency).toBeLessThanOrEqual(0.65);
  });
});

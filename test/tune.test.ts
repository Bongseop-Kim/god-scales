import { describe, expect, it } from "vitest";
import { buildTuningRecord } from "../tools/tune";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("tuning iteration", () => {
  it("records a complete no-op iteration without changing frozen parameters", () => {
    const report = summarize(simulateStratified(100));
    const tuning = buildTuningRecord(report, report, 1);
    expect(tuning).toMatchObject({ loop_iteration: 1, auto_adjusted: 0, enemy_adjusted: 0, discarded: 0 });
    expect(tuning.variance_after).toBe(tuning.variance_before);
    expect(tuning.human_intervened.length).toBeGreaterThan(0);
  });
});

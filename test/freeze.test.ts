import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("frozen parameter versions", () => {
  it("freezes versions inside the target win and block bands", () => {
    const report = summarize(simulateStratified(2000));
    expect(report.bot_policy_version).toBe("v2");
    expect(report.global_param_version).toBe("v1");
    expect(report.winRate).toBeGreaterThanOrEqual(0.15);
    expect(report.winRate).toBeLessThanOrEqual(0.7);
    expect(report.block_efficiency).toBeGreaterThanOrEqual(0.8);
    expect(report.block_efficiency).toBeLessThanOrEqual(1.2);
  });
});

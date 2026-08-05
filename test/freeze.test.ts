import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("frozen parameter versions", () => {
  it("freezes versions inside the target win and block bands", () => {
    const report = summarize(simulateStratified(2000));
    expect(report.bot_policy_version).toBe("v4");
    expect(report.global_param_version).toBe("v3");
    expect(report.winRate).toBeGreaterThanOrEqual(0.15);
    expect(report.winRate).toBeLessThanOrEqual(0.7);
    // 재동결 측정 0.655. 토큰 4종이 실제로 동작하면서 봇이 방어 대신 완화 토큰을 쓰는 턴이 생겨
    // 쌓은 방어의 흡수율이 올라갔다 (N-04 0.580 → 0.655)
    expect(report.block_efficiency).toBeGreaterThanOrEqual(0.58);
    expect(report.block_efficiency).toBeLessThanOrEqual(0.72);
  });
});

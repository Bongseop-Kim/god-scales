import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("frozen parameter versions", () => {
  it("freezes versions inside the target win and block bands", () => {
    const report = summarize(simulateStratified(2000));
    expect(report.bot_policy_version).toBe("v8");
    expect(report.global_param_version).toBe("v7");
    expect(report.winRate).toBeGreaterThanOrEqual(0.15);
    expect(report.winRate).toBeLessThanOrEqual(0.7);
    // 재측정 0.812. P-22에서 아테나 완화를 걷어내자 쌓는 방어가 줄어 거의 전부 소모된다.
    // 천장이 1.0이라 이 지표는 여기서부터 포화한다 — 더 올라가면 뜻을 잃는다
    expect(report.block_efficiency).toBeGreaterThanOrEqual(0.74);
    expect(report.block_efficiency).toBeLessThanOrEqual(0.88);
  });
});

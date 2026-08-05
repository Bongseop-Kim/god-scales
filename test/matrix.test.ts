import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("pairing matrix", () => {
  it("fills ten evenly stratified cells and computes within-pairing deltas", () => {
    const report = summarize(simulateStratified(200));
    expect(Object.values(report.runs_by_pairing)).toEqual(Array(10).fill(20));
    const cells = Object.entries(report.win_rate_matrix).flatMap(([left, row]) => Object.entries(row).filter(([right, value]) => left < right && value !== null));
    expect(cells).toHaveLength(10);
    // P-22의 신별 풀 게이트(완화 비율 ≤0.30, 장당 기대값 ≤5.5)로 0.288 → 0.188이 됐다
    // (reports/round-6/simulation.json, 64000런). 5회차 이래 덮여 있던 0.35를 실측값으로 내려 잠근다.
    // 목표 0.08과는 아직 멀고, 승률이 0.377 → 0.302로 내려간 만큼의 압축이 섞여 있다 — reviews/23-round6.md 참조
    expect(report.pairing_win_stddev).toBeLessThanOrEqual(0.24);
    // 승률이 내려가면 표준편차는 기계적으로 작아진다. 척도에 불변인 짝을 같이 잠가야 그 압축으로 밴드를
    // 통과하는 길이 막힌다 — 5회차 0.763 → 6회차 0.623(64000런), 여기 200런 측정은 0.607
    expect(report.pairing_win_cv).toBeLessThanOrEqual(0.70);
    expect(report.card_win_delta).toEqual(expect.any(Object));
  });
});

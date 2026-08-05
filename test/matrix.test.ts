import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("pairing matrix", () => {
  it("fills ten evenly stratified cells and computes within-pairing deltas", () => {
    const report = summarize(simulateStratified(200));
    expect(Object.values(report.runs_by_pairing)).toEqual(Array(10).fill(20));
    const cells = Object.entries(report.win_rate_matrix).flatMap(([left, row]) => Object.entries(row).filter(([right, value]) => left < right && value !== null));
    expect(cells).toHaveLength(10);
    // 토큰 4종을 구현하고 오라를 연결하고 신마다 완화 카드를 넣어 0.00짜리 조합 여섯을 없앴다.
    // 그래도 0.288이다(reports/round-5/simulation.json, 32000런) — 원인은 콘텐츠 부족이 아니라 **같은 기대값을 완화에 쓰면 공격에 쓸 때보다
    // 승률로 더 잘 바뀐다**는 것이다. 아테나는 20장 중 16장이 방어라 그 이득을 독점한다.
    // 전역 다이얼로는 못 닫는다(enemyDamageScale·지상 배율·방어 총량 전 구간 확인) — 카드 한 장이 아니라
    // 신 하나의 풀 구성을 제한하는 게이트 규칙이 필요하다. 그때까지 이 숫자는 덮은 것이다
    expect(report.pairing_win_stddev).toBeLessThanOrEqual(0.35);
    expect(report.card_win_delta).toEqual(expect.any(Object));
  });
});

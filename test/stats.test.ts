import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine.ts";
import { computeStats } from "../sim/stats.ts";
import { StatsPage } from "../ui/stats.tsx";

/** 조합당 시드 하나 — 페이지가 요구하는 것은 모양이지 표본 크기가 아니다. 2000런은 `npm run stats`가 돈다 */
const stats = computeStats(simulateStratified(10));

describe("computeStats", () => {
  it("Δ 히스토그램의 합이 스텝 수다", () => {
    const total = Object.values(stats.favor.deltaHist).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(stats.favor.steps);
    expect(stats.favor.steps).toBeGreaterThan(0);
  });

  it("단계 점유율 넷의 합이 1이다", () => {
    for (const share of [stats.favor.stageShare, stats.winVsLoss.won.stageShare, stats.winVsLoss.lost.stageShare]) {
      const sum = Object.values(share).reduce((all, value) => all + value, 0);
      if (Object.values(share).some((value) => value > 0)) expect(sum).toBeCloseTo(1, 1);
    }
  });

  it("비율은 전부 0~1 안이다", () => {
    const rates = [stats.meta.winRate, stats.favor.bigShare, stats.favor.crossShare,
      ...Object.values(stats.clear.winRateMatrix).flatMap((row) => Object.values(row).filter((value): value is number => value !== null)),
      ...Object.values(stats.clear.encounterClearRate)];
    for (const rate of rates) { expect(rate).toBeGreaterThanOrEqual(0); expect(rate).toBeLessThanOrEqual(1); }
  });

  it("매트릭스는 대각이 null이고 대칭이다", () => {
    const names = Object.keys(stats.clear.winRateMatrix);
    expect(names).toHaveLength(5);
    for (const god of names) expect(stats.clear.winRateMatrix[god][god]).toBeNull();
    for (const a of names) for (const b of names) expect(stats.clear.winRateMatrix[a][b]).toBe(stats.clear.winRateMatrix[b][a]);
  });

  it("대표 궤적은 신 둘의 점열이다", () => {
    expect(stats.favor.samples.length).toBeGreaterThan(0);
    for (const sample of stats.favor.samples) {
      expect(sample.gods).toHaveLength(2);
      for (const point of sample.points) expect(point).toHaveLength(2);
    }
  });

  it("같은 층화는 같은 집계다 — 페이지 데이터가 결정론이다", () => {
    expect(computeStats(simulateStratified(10))).toEqual(stats);
  });
});

describe("StatsPage", () => {
  const markup = renderToStaticMarkup(createElement(StatsPage, { data: stats }));

  it("세 섹션이 다 선다", () => {
    for (const heading of ["우호도의 움직임", "클리어 / 실패", "승리 런의 특징"]) expect(markup).toContain(heading);
  });

  it("매트릭스에 신 이름이, 궤적에 경계 라벨이 뜬다", () => {
    expect(markup).toContain("제우스");
    for (const stage of ["헌신", "평온", "분노", "진노"]) expect(markup).toContain(stage);
  });
});

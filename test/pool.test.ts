import { describe, expect, it } from "vitest";
import cardData from "../data/cards.json" with { type: "json" };
import godData from "../data/gods.json" with { type: "json" };
import { poolRatioMax, poolStat, poolValueMax, validateItems } from "../tools/validate";

/**
 * 카드 한 장짜리 픽스처로는 이 규칙을 못 보여준다 — 위반은 신 하나의 풀 전체가 만든다.
 * 그래서 깨진 픽스처 대신 배포된 풀과 합성 풀을 직접 잰다
 */
describe("per-god pool gate", () => {
  it("keeps every shipped pool inside the mitigation and value caps", () => {
    for (const { id } of godData) {
      const pool = cardData.filter((card) => card.patron === id);
      const { ratio, average } = poolStat(pool);
      expect(ratio, `${id} mitigation ratio`).toBeLessThanOrEqual(poolRatioMax);
      expect(average, `${id} average value`).toBeLessThanOrEqual(poolValueMax);
    }
  });

  it("rejects a pool that spends everything on mitigation", () => {
    // 열 장 전부 block 하나짜리다. 장당 기대값은 4.0~8.0으로 4~8 밴드 안이라 기존 게이트는 다 통과시킨다.
    // 값이 흩어진 이유는 `duplicateFailure`의 지문이 value를 3으로 나눠 버킷팅하기 때문 — 같은 버킷이면 중복으로 먼저 걸린다
    const turtles = [[5, 1], [6, 1], [9, 1], [12, 2], [15, 2], [18, 2], [21, 3], [24, 3], [27, 3], [30, 3]].map(([value, cost], index) => ({
      id: `card_athena_turtle_${index}`,
      name: `거북 ${index}`,
      patron: "athena",
      cost,
      target: "self",
      effects: [{ op: "block", value }],
      tags: ["defend"],
    }));
    const report = validateItems(turtles);
    expect(report.rejected.some(({ failure }) => failure === "pool_ratio")).toBe(true);
  });
});

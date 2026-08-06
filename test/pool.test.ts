import { describe, expect, it } from "vitest";
import cardData from "../data/cards.json" with { type: "json" };
import godData from "../data/gods.json" with { type: "json" };
import { poolRatioMax, poolStat, poolValueMax, validateItems } from "../tools/validate";
import { cardTier } from "../tools/value";

/**
 * 카드 한 장짜리 픽스처로는 이 규칙을 못 보여준다 — 위반은 신 하나의 풀 전체가 만든다.
 * 그래서 깨진 픽스처 대신 배포된 풀과 합성 풀을 직접 잰다
 */
describe("per-god pool gate", () => {
  it("keeps every shipped pool inside the mitigation and value caps", () => {
    for (const { id } of godData) {
      const pool = cardData.filter((card) => card.patron === id);
      // 완화 비율은 tier로 갈리지 않는다 — 완화는 신의 성격이지 등급이 아니다
      expect(poolStat(pool).ratio, `${id} mitigation ratio`).toBeLessThanOrEqual(poolRatioMax);
      // 장당 기대값은 계단마다 상한이 다르다. tier2 세 장이 tier1 평균에 섞이면 5.5가 뜻을 잃는다
      for (const [tier, cap] of Object.entries(poolValueMax)) {
        const step = pool.filter((card) => cardTier(card) === Number(tier));
        if (step.length === 0) continue;
        expect(poolStat(step).average, `${id} tier${tier} average value`).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("rejects a pool that spends everything on mitigation", () => {
    /**
     * 열 장 전부 block 하나짜리다. 장당 기대값은 4.0~7.2으로 tier1 밴드 `[4, 8)` 안이라 개별 판정은 다 통과한다.
     * 값이 흩어진 이유는 `duplicateFailure`의 지문이 value를 3으로 나눠 버킷팅하기 때문 — 같은 버킷이면 중복으로 먼저 걸린다.
     * 옛 열째 장은 block 30(값 8.0)이었는데 반개구간이 그것을 밴드 밖으로 밀어냈고, 아홉 장은 「10장 미만」이라
     * 풀 규칙이 아예 안 돈다 — 그래서 열째만 같은 완화인 `bulwark`로 바꿨다
     */
    const turtles = [[5, 1], [6, 1], [9, 1], [12, 2], [15, 2], [18, 2], [21, 3], [24, 3], [27, 3]].map(([value, cost], index) => ({
      id: `card_athena_turtle_${index}`,
      name: `거북 ${index}`,
      patron: "athena",
      cost,
      target: "self",
      effects: [{ op: "block", value }],
      tags: ["defend"],
    }));
    const report = validateItems([...turtles, {
      id: "card_athena_turtle_9",
      name: "거북 9",
      patron: "athena",
      cost: 2,
      target: "self",
      effects: [{ op: "apply_token", token: "bulwark", stacks: 4 }],
      tags: ["defend", "token"],
    }]);
    expect(report.rejected.some(({ failure }) => failure === "pool_ratio")).toBe(true);
  });
});

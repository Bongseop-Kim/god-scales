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
     * 열 장 전부 완화 하나짜리다. 장당 기대값은 4.0~5.7이라 tier1 밴드 `[4, 8)` 안이고 개별 판정은 다 통과한다.
     *
     * **열 장이 서로 다른 모양이어야 한다**(P-44) — 지문이 값을 버리고 모양만 들므로 옛 판의
     * 「block 하나짜리 아홉 장」은 이제 여덟 장이 `duplicate`로 먼저 걸리고, 남은 둘로는 「10장 미만」이라
     * 풀 규칙이 아예 안 돈다. 아테나의 완화 어휘 셋(`block`·`bulwark`·`deflect`)과 조건 유무를 조합해
     * 열 모양을 만든다 — 값이 아니라 모양이 장수를 만드는 것이 §1이 옮긴 축 그 자체다
     */
    const guard = (op: string, amount: number) => (op === "block" ? { op, value: amount } : { op: "apply_token", token: op, stacks: amount });
    const turtles = [
      [["block", 5], 1, false], [["block", 12], 1, true],
      [["bulwark", 2], 1, false], [["bulwark", 4], 1, true],
      [["deflect", 1], 2, false], [["deflect", 2], 2, true],
      [["block", 4], 1, false, ["bulwark", 1]],
      [["block", 5], 3, false, ["deflect", 1]],
      [["bulwark", 2], 3, false, ["deflect", 1]],
      [["block", 3], 3, false, ["bulwark", 1], ["deflect", 1]],
    ].map((row, index) => {
      const [first, cost, conditional, ...rest] = row as [[string, number], number, boolean, ...[string, number][]];
      const effects = [first, ...rest].map(([op, amount]) => guard(op, amount));
      return {
        id: `card_athena_turtle_${index}`,
        name: `거북 ${index}`,
        patron: "athena",
        cost,
        target: "self",
        effects: conditional ? effects.map((effect) => ({ ...effect, when: "turn > 2" })) : effects,
        tags: ["defend", "token"],
      };
    });
    const report = validateItems(turtles);
    // 개별 판정은 열 장이 다 지난다 — 반려는 풀이 다 모인 뒤에야 뜬다
    expect(report.rejected.map(({ failure }) => failure).filter((failure) => failure !== "pool_ratio")).toEqual([]);
    expect(report.rejected.some(({ failure }) => failure === "pool_ratio")).toBe(true);
  });
});

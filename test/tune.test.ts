import { describe, expect, it } from "vitest";
import { compare } from "../tools/tune";
import { chooseCard, setEpsilon } from "../sim/bots/rule";
import { createCombat } from "../core/combat";
import type { Card } from "../core/rules";

const strike: Card = { id: "strike", name: "타격", patron: "ares", cost: 1, target: "enemy", effects: [{ op: "damage", value: 6 }], tags: ["attack"] };
const graze: Card = { ...strike, id: "graze", effects: [{ op: "damage", value: 1 }] };

describe("epsilon comparison", () => {
  it("flags flat pairings, floor misses, and ignores low-win-rate cells", () => {
    const rows = compare({ skill: 0.5, flat: 0.5, dead: 0.02 }, { skill: 0.2, flat: 0.48, dead: 0.02 });
    expect(rows.map(({ flat, below }) => [flat, below])).toEqual([[false, false], [true, false], [false, true]]);
  });

  it("picks a random legal card under epsilon and ignores the rng at zero", () => {
    const cardMap = new Map([strike, graze].map((card) => [card.id, card]));
    // 적이 하나는 서 있어야 한다 — 사거리 안에 산 적이 없으면 공격 카드는 합법수가 아니다(P-35)
    const combat = createCombat(1, [], [{ id: "dummy", hp: 20, pattern: [{ damage: 1 }] }]);
    combat.hand = ["strike", "graze"];
    combat.energy = 3;
    expect(chooseCard(combat, cardMap, new Map())).toBe("strike");
    setEpsilon(1);
    try {
      // rng를 상수 0.9로 주면 ε는 항상 터지고 floor(0.9 × 2) = 손패 두 번째를 고른다
      expect(chooseCard(combat, cardMap, new Map(), {}, () => 0.9)).toBe("graze");
    } finally {
      setEpsilon(0);
    }
    expect(chooseCard(combat, cardMap, new Map(), {}, () => 0.9)).toBe("strike");
  });
});

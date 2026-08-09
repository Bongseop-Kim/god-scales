import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { awardGrace } from "../core/favor";
import { graceOffer, graceTier, takeGrace, type Grace, type GraceHeld } from "../core/grace";
import { cardEffects } from "../core/rules";
import type { Card } from "../core/rules";
import type { GameState } from "../core/state";
import { createCombat } from "../core/combat";
import { simulate } from "../sim/engine";
import { summarize } from "../sim/report";

const graces = JSON.parse(readFileSync("data/graces.json", "utf8")) as Grace[];
const row = (id: string, tier: number) => graces.find((grace) => grace.id === id && grace.tier === tier)!;

const card: Card = {
  id: "card",
  name: "card",
  patron: "zeus",
  cost: 1,
  target: "enemy",
  effects: [{ op: "damage", value: 5 }],
  tags: ["attack", "token"],
};

describe("grace", () => {
  it("awards one grace to each devoted patron", () => {
    const grace: Record<string, number> = {};
    expect(awardGrace({ zeus: 70, athena: 69 }, grace, ["zeus", "athena"])).toEqual(["zeus"]);
    expect(grace).toEqual({ zeus: 1 });
    // 둘 다 헌신이면 둘 다 받는다 — 이 자리가 옛 규칙에서 비어 있어 합성이 열리지 않았다
    expect(awardGrace({ zeus: 70, athena: 70 }, grace, ["zeus", "athena"])).toEqual(["zeus", "athena"]);
    expect(grace).toEqual({ zeus: 2, athena: 1 });
    expect(awardGrace({ zeus: 50, athena: 50 }, grace, ["zeus", "athena"])).toEqual([]);
  });

  it("ladders tier by the count of grace earned from that god", () => {
    expect([0, 1, 3, 4, 5, 6, 9].map(graceTier)).toEqual([2, 2, 2, 4, 4, 6, 6]);
  });

  it("offers three of that god's graces with the empty slots first", () => {
    const held: GraceHeld = {};
    const first = graceOffer(graces, "zeus", held, 2);
    expect(first).toHaveLength(3);
    expect(first.every(({ patron, tier }) => patron === "zeus" && tier === 2)).toBe(true);
    // 제우스 셋은 슬롯이 서로 다르다 — 그래서 신당 설계 셋으로 3택1이 선다
    expect(new Set(first.map(({ slot }) => slot)).size).toBe(3);

    takeGrace(graces, held, row("grace_zeus_attack_shock", 2));
    // 찬 슬롯은 뒤로 밀린다
    expect(graceOffer(graces, "zeus", held, 2).at(-1)!.slot).toBe("attack");
  });

  it("keeps the slot's tier when a grace is replaced", () => {
    const held: GraceHeld = {};
    // 아테나 은혜 넷을 받아 tier 4가 된 공격 슬롯에 제우스의 첫 은혜(tier 2)를 놓는다
    takeGrace(graces, held, row("grace_athena_attack_damage", 4));
    takeGrace(graces, held, row("grace_zeus_attack_shock", 2));
    expect(held.attack).toMatchObject({ id: "grace_zeus_attack_shock", tier: 4 });
    expect(held.attack!.effects).toEqual(row("grace_zeus_attack_shock", 4).effects);
    // 후보도 그 tier의 줄로 뜬다 — tier 2 줄을 내보내면 화면과 봇이 실제보다 약한 것을 보고 고른다
    expect(graceOffer(graces, "zeus", held, 2).find(({ slot }) => slot === "attack")).toEqual(row("grace_zeus_attack_shock", 4));
  });

  it("adds a slot's grace to every card carrying that tag", () => {
    const state = {
      seed: 1,
      combat: createCombat(1, [], []),
      favor: {},
      grace: {},
      graceSlots: {} as GraceHeld,
      map: { depth: 0, lane: 1, grid: [], completed: [] },
    } as GameState;
    expect(cardEffects(state, card)).toBe(card.effects);

    const shock = row("grace_zeus_attack_shock", 2);
    const block = row("grace_ares_token_block", 2);
    takeGrace(graces, state.graceSlots, shock);
    takeGrace(graces, state.graceSlots, block);
    // 태그가 둘이면 은혜도 둘 붙는다. 방어 슬롯은 비어 있으므로 아무것도 더하지 않는다
    expect(cardEffects(state, card)).toEqual([...card.effects, ...shock.effects, ...block.effects]);
  });

  it("excludes scenario runs from the base win rate", () => {
    const scenario = summarize(simulate(20, "grace_6"));
    expect([scenario.runs, scenario.scenario_runs, scenario.grace_milestones[6]]).toEqual([0, 20, 1]);
  });
});

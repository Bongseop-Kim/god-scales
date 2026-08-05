import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyFavorStageEffects,
  favorBoundaries,
  favorStage,
  finishCombatFavor,
  finishRestFavor,
  recordCardFavor,
  shiftFavor,
  type FavorGod,
} from "../core/favor";
import { createCombat } from "../core/combat";
import type { GameState } from "../core/state";
import { validateItems } from "../tools/validate";

const state = (): GameState => ({
  seed: 1,
  favor: { zeus: 70, poseidon: 9 },
  grace: {},
  graceSlots: {},
  map: { depth: 0, lane: 1, grid: [], completed: [] },
  combat: createCombat(1, [], [{ id: "enemy", hp: 10, pattern: [{ damage: 1 }] }]),
});

describe("favor", () => {
  it("caps card gains at five and applies encounter decay and neglect", () => {
    const favor = { zeus: 50, poseidon: 50 };
    const uses: Record<string, number> = {};
    for (let count = 0; count < 8; count += 1) recordCardFavor(favor, "zeus", uses);
    expect(favor.zeus).toBe(55);
    finishCombatFavor(favor, ["zeus", "poseidon"], uses);
    expect(favor).toEqual({ zeus: 52, poseidon: 45 });
    finishRestFavor(favor, ["zeus", "poseidon"]);
    expect(favor).toEqual({ zeus: 49, poseidon: 42 });
  });

  it("clamps favor and classifies all four boundaries", () => {
    const favor = { zeus: 100, poseidon: 0 };
    expect([shiftFavor(favor, "zeus", 1), shiftFavor(favor, "poseidon", -1)]).toEqual([100, 0]);
    expect([favorStage(favorBoundaries.devotion), favorStage(favorBoundaries.calm), favorStage(favorBoundaries.anger), favorStage(favorBoundaries.wrath)]).toEqual(["devotion", "calm", "anger", "wrath"]);
  });

  // 개입은 토큰 부여를 넘어 **행동**이다 — 제우스 헌신은 적 하나를 8로 때리고 포세이돈 진노는 내 타격을 적신다
  it("acts on the board at encounter start, devotion outward and wrath inward", () => {
    const game = state();
    const gods = JSON.parse(readFileSync("data/gods.json", "utf8")) as FavorGod[];
    applyFavorStageEffects(game, gods.filter(({ id }) => id === "zeus" || id === "poseidon"));
    expect(game.combat.enemies[0].hp).toBe(2);
    expect(game.combat.player.tokens.soaked).toBe(2);
  });

  it("rejects foreign tokens in global effects", () => {
    const god = JSON.parse(readFileSync("data/gods.json", "utf8"))[0];
    god.stage_effects.devotion.on_encounter_start = [{ op: "apply_token", token: "bleed", stacks: 1, target: "all_enemies" }];
    expect(validateItems([god]).rejected[0].failure).toBe("token_scope");
  });

  // 효과에 박아 넣은 페널티는 신의 변덕이 아니라 비용이다 — 나쁜 결과는 적 능력에서만 나와야 한다
  it("rejects a devotion intervention that costs the player", () => {
    const god = JSON.parse(readFileSync("data/gods.json", "utf8"))[0];
    god.stage_effects.devotion.on_encounter_start = [{ op: "apply_token", token: "shock", stacks: 2, target: "self" }];
    expect(validateItems([god]).rejected[0].failure).toBe("value_outlier");
  });
});

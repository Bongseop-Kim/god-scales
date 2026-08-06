import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyFavorStageEffects,
  favorBoundaries,
  favorStage,
  finishCombatFavor,
  finishRestFavor,
  intervenesOnTurn,
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

  // 네 단계가 다 개입한다 — 평온이 조우의 6할인데 거기서 신이 침묵하던 것이 P-34가 고친 자리다
  it("intervenes mid-combat in all four stages", () => {
    const gods = JSON.parse(readFileSync("data/gods.json", "utf8")) as FavorGod[];
    const cells = gods.flatMap(({ stage_effects }) => Object.values(stage_effects).map(({ on_turn_start }) => on_turn_start?.length ?? 0));
    expect([cells.length, cells.filter((count) => count > 0).length]).toEqual([20, 20]);
    const game = state();
    game.favor = { zeus: 70, poseidon: 50 };
    game.combat.player.hp = 90;
    applyFavorStageEffects(game, gods.filter(({ id }) => id === "zeus" || id === "poseidon"), "on_turn_start");
    // 헌신 제우스는 적을 감전시키고, **평온** 포세이돈은 나를 1 회복시킨다 — 평온도 개입한다
    expect(game.combat.enemies[0].tokens.shock).toBe(1);
    expect(game.combat.player.hp).toBe(91);
    // 주기는 조우 시작과 겹치지 않게 한 칸 밀려 있다 — 2·5·8턴
    expect([1, 2, 3, 4, 5].map(intervenesOnTurn)).toEqual([false, true, false, false, true]);
  });

  // 회복 처벌이 시체를 일으키면 조우가 안 끝난다 — `targets()`가 죽은 적을 거른다
  it("keeps healing interventions off dead enemies", () => {
    const game = state();
    game.favor = { ares: 5 };
    game.combat.enemies[0].hp = 0;
    applyFavorStageEffects(game, JSON.parse(readFileSync("data/gods.json", "utf8")).filter(({ id }: FavorGod) => id === "ares"), "on_turn_start");
    expect(game.combat.enemies[0].hp).toBe(0);
  });

  it("rejects a persistent token in the per-turn hook", () => {
    const god = JSON.parse(readFileSync("core/__fixtures__/broken/21-persistent-turn-effect.json", "utf8"));
    expect(validateItems([god]).rejected[0].failure).toBe("token_scope");
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

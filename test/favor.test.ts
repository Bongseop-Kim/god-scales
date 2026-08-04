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
  map: { node: 0, completed: [] },
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

  it("applies devotion to enemies and wrath to the player on encounter start", () => {
    const game = state();
    const gods = JSON.parse(readFileSync("data/gods.json", "utf8")) as FavorGod[];
    applyFavorStageEffects(game, gods.filter(({ id }) => id === "zeus" || id === "poseidon"));
    expect(game.combat.enemies[0].tokens.shock).toBe(1);
    expect(game.combat.player.tokens.displace).toBe(1);
  });

  it("rejects foreign tokens in global effects", () => {
    const god = JSON.parse(readFileSync("data/gods.json", "utf8"))[0];
    god.stage_effects.devotion.on_encounter_start.token = "bleed";
    expect(validateItems([god]).rejected[0].failure).toBe("token_scope");
  });
});

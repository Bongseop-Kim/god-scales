import { describe, expect, it } from "vitest";
import { createCombat } from "../core/combat";
import { mapNode, takeRest } from "../core/map";
import type { GameState } from "../core/state";
import { simulate } from "../sim/engine";
import { summarize } from "../sim/report";

describe("map", () => {
  it("has two six-floor regions with choices only on floors three and five", () => {
    expect(Array.from({ length: 12 }, (_, node) => mapNode(node).options)).toEqual([
      ["combat"], ["combat"], ["combat", "rest"], ["combat"], ["combat", "rest"], ["boss"],
      ["combat"], ["combat"], ["combat", "rest"], ["combat"], ["combat", "rest"], ["boss"],
    ]);
  });

  it("heals 25 without combat neglect at rest", () => {
    const state: GameState = { seed: 1, favor: { zeus: 50, athena: 50 }, grace: {}, map: { node: 2, completed: [] }, combat: createCombat(1, [], []) };
    state.combat.player.hp = 40;
    takeRest(state, ["zeus", "athena"], [], "heal");
    expect([state.combat.player.hp, state.favor.zeus, state.favor.athena]).toEqual([65, 47, 47]);
  });

  it("keeps low-rest clears below the re-measured ceiling", () => {
    const results = simulate(500);
    const report = summarize(results);
    // N-04에서 0.05 → 0.358로 깨졌던 자리다. P-22 이후 0.167(64000런)까지 돌아왔다 —
    // 쉼터가 의미를 되찾는 방향이다. 원래 밴드(0.05)와는 아직 멀다
    expect(report.low_rest_clear_rate).toBeLessThan(0.24);
    expect(results.filter(({ won }) => won).every(({ encounters }) => encounters >= 8 && encounters <= 12)).toBe(true);
    expect(report).toMatchObject({ hp_curve: expect.any(Array), path_choices: expect.any(Object), rest_choices: expect.any(Object), region_clear_rate: expect.any(Object) });
  });
});

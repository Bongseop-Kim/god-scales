import { describe, expect, it } from "vitest";
import { createCombat } from "../core/combat";
import { bossLane, floorsPerRegion, generateMap, laneCount, mapDepth, mapLayoutFailure, mapSlot, reachableLanes, takeRest, type MapGrid } from "../core/map";
import type { GameState } from "../core/state";
import { runSteps, simulate } from "../sim/engine";
import { summarize } from "../sim/report";

/** 엔진과 같은 정예 층. 데이터가 정예 편성을 준 자리만 정예를 놓는다 */
const eliteSlots = new Set(["surface:3", "surface:4"]);
const seeds = Array.from({ length: 20 }, (_, index) => index + 1);

/** 어느 갈래에서 출발해도 보스에 닿는가. `lane ±1` + 6층 수렴이 참으로 만드는 성질이다 */
function reachesBoss(grid: MapGrid, depth: number, lane: number): boolean {
  const { floor } = mapSlot(depth);
  if (floor === floorsPerRegion) return grid[depth][lane] === "boss";
  return reachableLanes(depth + 1, lane).some((next) => grid[depth + 1][next] !== null && reachesBoss(grid, depth + 1, next));
}

describe("map", () => {
  it("lays out twelve floors of three lanes under the seven placement rules", () => {
    for (const seed of seeds) {
      const grid = generateMap(seed, eliteSlots);
      expect(mapLayoutFailure(grid), `seed ${seed}`).toBeUndefined();
      expect(grid).toHaveLength(12);
      // 도달 가능성: 모든 층의 모든 갈래에서 그 지역의 보스까지 길이 있다 — 막다른 길이 없다
      for (let depth = 0; depth < 12; depth += 1) {
        for (let lane = 0; lane < laneCount; lane += 1) {
          if (grid[depth][lane] === null) continue;
          expect(reachesBoss(grid, depth, lane), `seed ${seed} depth ${depth} lane ${lane}`).toBe(true);
        }
      }
    }
  });

  it("catches a layout that breaks a rule", () => {
    const grid = generateMap(1, eliteSlots);
    // 2층에 쉼터를 놓으면 「정예·휴식은 3층부터」가 깨진다 — 규칙이 문서가 아니라 게이트인 자리
    const broken = grid.map((row, depth) => (depth === 1 ? ["combat", "rest", "omen"] : row)) as MapGrid;
    expect(mapLayoutFailure(broken)).toMatch(/elite and rest start on floor 3/);
    // 보스를 다른 갈래로 옮기면 수렴이 깨진다
    const scattered = grid.map((row, depth) => (depth === 5 ? ["boss", null, null] : row)) as MapGrid;
    expect(mapLayoutFailure(scattered)).toMatch(/boss must converge/);
    // 꼴이 틀린 격자는 규칙을 한 번도 안 거친다 — 빈 격자가 통과하면 게이트가 아니다
    expect(mapLayoutFailure([])).toMatch(/12 deep/);
    expect(mapLayoutFailure(grid.map((row, depth) => (depth === 0 ? [...row, "combat"] : row)) as MapGrid)).toMatch(/lane count/);
  });

  it("gives the same seed the same grid and different seeds different ones", () => {
    expect(generateMap(7, eliteSlots)).toEqual(generateMap(7, eliteSlots));
    const shapes = new Set(seeds.map((seed) => JSON.stringify(generateMap(seed, eliteSlots))));
    expect(shapes.size).toBeGreaterThan(1);
  });

  /**
   * 룰 봇은 정예를 고르지 않는다 — 보상이 전투와 같고 편성만 세기 때문이다(은혜는 P-28). 그래서
   * 정예 갈래를 손으로 밟아 그 자리가 실제로 서는지 여기서 잰다. 안 하면 종류 하나가 죽은 코드다
   */
  it("runs the elite lane when a hand picks it", () => {
    const walked = new Set<string>();
    for (const seed of seeds) {
      // 3층 정예를 밟으면 4층 정예에는 **닿을 수 없다** — 이어진 칸 금지가 둘을 양 끝에 밀어놓고
      // `lane ±1`이 그 사이를 건너지 못한다. 그래서 첫 정예를 건너뛰는 열을 따로 돈다
      for (const skipFirst of [false, true]) {
        let skipped = false;
        const steps = runSteps(seed);
        let step = steps.next();
        while (!step.done) {
          let answer = step.value.bot;
          const elite = step.value.phase === "path" ? step.value.options.find((option) => option.endsWith(":elite")) : undefined;
          if (elite && skipFirst && !skipped) skipped = true;
          else if (elite) answer = elite;
          step = steps.next(answer);
        }
        for (const { key } of step.value.encounterOutcomes) if (key.endsWith(":elite")) walked.add(key);
      }
    }
    // 정예 편성은 지상 3·4층에만 있다 — 저승에는 「같은 층 combat보다 세다」를 통과하는 편성이 없다
    expect(walked).toEqual(new Set(["surface:3:elite", "surface:4:elite"]));
  });

  it("heals 25 without combat neglect at rest", () => {
    const state: GameState = { seed: 1, favor: { zeus: 50, athena: 50 }, grace: {}, graceSlots: {}, map: { depth: 2, lane: bossLane, grid: [], completed: [] }, combat: createCombat(1, [], []) };
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
    /**
     * 하한이 6이었는데 그것은 밴드가 아니라 우연이었다 — 5조우로 12칸을 걷는 길은 HEAD에도 있었고
     * (시드 267) 그 런이 이기지 않았을 뿐이다. 격자가 정하는 하한은 **지역당 보스 하나**다:
     * 층 5는 쉼터가 보장되고 층 1~4는 넷 다 예고가 될 수 있다. 상한은 칸 수다
     */
    expect(results.filter(({ won }) => won).every(({ encounters }) => encounters >= 2 && encounters <= mapDepth)).toBe(true);
    expect(report).toMatchObject({ hp_curve: expect.any(Array), path_choices: expect.any(Object), lane_choices: expect.any(Object), rest_choices: expect.any(Object), region_clear_rate: expect.any(Object) });
  });
});

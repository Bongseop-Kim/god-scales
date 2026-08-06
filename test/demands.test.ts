import { describe, expect, it } from "vitest";
import demandData from "../data/demands.json" with { type: "json" };
import godData from "../data/gods.json" with { type: "json" };
import { demandPenalty, demandSatisfied, pairKey, payDemandCost, resolveDemand, rivals, tierEnemies, type Demand } from "../core/demands";
import { createCombat } from "../core/combat";
import type { GameState } from "../core/state";
import { run, runSteps, simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";
import type { ReplayAction } from "../sim/replay";
import { validateItems } from "../tools/validate";

const demands = demandData as Demand[];
const athena = demands.find(({ id }) => id === "demand_athena_safe")!;
/** 배포된 수락 단의 보상. 상수를 여기 적으면 데이터와 어긋나는 두 번째 진실이 된다 */
const acceptReward = demands[0].tiers[0].reward.favor!;
/** 첫 요구만 고정하고 나머지는 봇에게 맡긴다 — 곡선이 처음 갈라지는 자리가 그 요구 하나의 값이다 */
const firstAnswer = (choice: "tier1" | "tier2" | "reject"): ReplayAction[] => [{ type: "demand", choice }];
const everyAnswer = (choice: "tier1" | "tier2" | "reject"): ReplayAction[] =>
  Array.from({ length: 14 }, () => ({ type: "demand", choice }));

const state = (): GameState => ({
  seed: 1,
  favor: { zeus: 50, athena: 50 },
  grace: {},
  graceSlots: {},
  map: { depth: 0, lane: 1, grid: [], completed: [] },
  combat: createCombat(1, [], []),
});

describe("demands", () => {
  it("keeps the core rival set equal to data/gods.json", () => {
    // core는 데이터를 읽지 않으므로 이 한 벌만 사본이다. 어긋나면 게이트와 런타임이 다른 게임을 판정한다
    const fromData = new Set(godData.flatMap((god) => god.rivals.map((rival) => pairKey(god.id, rival))));
    expect(rivals).toEqual(fromData);
  });

  it("resolves relationship penalties and has no failure penalty", () => {
    expect(demandPenalty("zeus", "poseidon")).toEqual({ amount: -18, key: "rival_18" });
    expect(demandPenalty("zeus", "athena")).toEqual({ amount: -9, key: "non_rival_9" });
    expect(demandPenalty("zeus", "artemis")).toEqual({ amount: 0, key: "none" });
    const favor = { zeus: 50, poseidon: 50 };
    // 단이 없으면 못 지킨 것이다 — 보상도 벌금도 안 움직인다
    expect(resolveDemand(favor, "zeus", "poseidon", undefined)).toBeUndefined();
    expect(favor).toEqual({ zeus: 50, poseidon: 50 });
    expect(resolveDemand(favor, "zeus", "poseidon", athena.tiers[0])).toBe("rival_18");
    expect(favor).toEqual({ zeus: 50 + acceptReward, poseidon: 32 });
  });

  /**
   * 선불이라는 말이 뜻을 갖는 자리. 값은 **고르는 순간** 나가고, 그 뒤에 약속을 못 지켜도 돌아오지 않는다 —
   * 그래서 요구가 수락/거절이 아니라 계산이 된다. 최대 체력이 내려가면 체력도 같이 잘린다
   */
  it("charges the trial up front, kept or not", () => {
    const game = state();
    const cost = athena.tiers[1].cost!;
    payDemandCost(game, "athena", cost);
    expect(game.favor.athena).toBe(50 - cost.favor!);
    expect([game.combat.player.maxHp, game.combat.player.hp]).toEqual([100 - cost.maxHp!, 100 - cost.maxHp!]);
    expect(resolveDemand(game.favor, "zeus", "athena", undefined)).toBeUndefined();
    expect(game.favor).toEqual({ zeus: 50, athena: 50 - cost.favor! });
  });

  /**
   * `omen` 칸은 통째로 「신이 조건을 하나 더 건다」라 요구가 안 뜨면 눌러도 화면이 안 바뀐다.
   * 조용히 넘어가는 길이 둘 있었고 방문의 43.7%가 그랬다:
   *
   * - 제우스의 요구는 적 둘 이상을 요구하는데 `omen`은 조우 크기를 모르니 1로 묻는다
   * - 걸어 둔 약속이 있으면 두 번째 `omen`을 삼켰다 (`omen`→`omen`, `omen`→쉼터→`omen`)
   */
  it("always asks something on an omen node", () => {
    const pairs = [["zeus", "athena"], ["zeus", "ares"], ["ares", "artemis"]] as const;
    let omens = 0;
    for (const pair of pairs) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const steps = runSteps(seed, undefined, pair);
        let step = steps.next();
        let afterOmen = false;
        while (!step.done) {
          if (afterOmen) expect(step.value.phase, `${pair.join("+")} seed ${seed}`).toBe("demand");
          afterOmen = step.value.phase === "path" && step.value.bot.endsWith(":omen");
          omens += afterOmen ? 1 : 0;
          step = steps.next(step.value.bot);
        }
        // 런이 `omen` 칸에서 끝나는 일은 없다 — 그 칸은 전투가 아니라 요구만 있다
        expect(afterOmen).toBe(false);
      }
    }
    expect(omens).toBeGreaterThan(0);
  });

  it("pays a demand only when the fight actually satisfied it", () => {
    /**
     * 요구는 전투 **앞에서** 묻고 그 전투로 판정한다. 그래서 「첫 요구」를 곡선이 **처음 갈라지는
     * 자리**로 찾는다 — 그 자리까지 두 런은 같은 칸을 같은 시드로 걸었으므로 차이는 요구 하나다.
     *
     * 시드 25 → 57 → 70 → 4 → 6 → 94 → 4 → **22**: P-34가 전투 중 개입을 넣자 시드 4의 첫 요구가
     * 더 이상 안 지켜진다(조우가 다르게 끝난다). 400시드 중 아래 넷을 다 만족하는 가장 앞을 다시 골랐다
     */
    const played = run(22, undefined, firstAnswer("tier1"));
    const refusedRun = run(22, undefined, firstAnswer("reject"));
    // 두 곡선이 다 든 자리에서만 찾는다 — 거절 런이 먼저 죽으면 없는 칸이 「갈라진 자리」로 읽힌다
    const at = played.favorCurve.findIndex((point, index) => index < refusedRun.favorCurve.length
      && JSON.stringify(point) !== JSON.stringify(refusedRun.favorCurve[index]));
    expect(at, "seed 22 never diverges on the first demand").toBeGreaterThan(0);

    // 시드 22의 첫 요구는 지켜진다 — 보상과 상대 신의 벌금이 그때 들어간다
    const kept = played.favorCurve[at];
    const refused = refusedRun.favorCurve[at];
    expect(kept.zeus - refused.zeus).toBe(acceptReward);
    expect(refused.athena - kept.athena).toBe(-demandPenalty("zeus", "athena").amount);

    // 시드 3 → **4**: 첫 요구를 수락해도 조건이 안 맞는다. 실패 벌금은 없으므로 거절과 결과가 같다 (R-5).
    // P-35가 편성을 네 칸으로 다시 눕히자 시드 3의 첫 요구가 지켜진다 — 400시드 중 가장 앞을 다시 골랐다
    expect(run(4, undefined, firstAnswer("tier1")).favorCurve).toEqual(run(4, undefined, firstAnswer("reject")).favorCurve);

    // 편든 신은 "지킨 신"이다 — 전부 거절하면 상대 쪽으로 넘어간다
    const rejected = run(22, undefined, everyAnswer("reject"));
    expect(rejected.actions.filter(({ type }) => type === "demand").map(({ choice }) => choice)).toContain("reject");
    expect(rejected.conflictChoice).toBe("athena");

    // 수락 대비 지킴 비율이 실제로 1이 아니다 — 조건 판정이 걸린다는 증거다. 키에 단이 들어 있다
    const outcome = played.demandOutcomes["demand_zeus_multi:tier1"];
    expect(outcome, "demand_zeus_multi tier1 not asked in seed 22").toBeDefined();
    const [asked, keptCount] = outcome;
    expect(keptCount).toBeGreaterThan(0);
    expect(keptCount).toBeLessThan(asked);
  });

  /**
   * 대가는 조우 하나로 끝나지 않는다 — `createCombat`이 매 조우 최대 체력을 100으로 되돌리므로
   * 이어 받지 않으면 선불이 첫 전투에서 사라진다. 기간이 지나면 여유가 돌아오는 것까지 같은 자리에서 본다
   */
  it("carries the trial cost across encounters and hands the headroom back", () => {
    const steps = runSteps(6);
    const roof: number[] = [];
    let step = steps.next();
    while (!step.done) {
      roof.push(step.value.observation.maxHp);
      const offered = step.value.phase === "demand" && step.value.options.includes("tier2");
      step = steps.next(offered ? "tier2" : step.value.bot);
    }
    const cost = athena.tiers[1].cost!.maxHp!;
    expect(new Set(roof)).toEqual(new Set([100, 100 - cost]));
    // 내려간 뒤에 다시 100이 나오는 자리가 있어야 기간이 실제로 만료된 것이다
    expect(roof.some((value, index) => value === 100 && roof.slice(0, index).some((prior) => prior < 100))).toBe(true);
  });

  /** 시련 중에는 시련이 다시 서지 않는다 — 겹치면 대가가 쌓여 최대 체력이 바닥으로 가는 나선이다 */
  it("never offers a second trial while one is running", () => {
    const steps = runSteps(11);
    let step = steps.next();
    let running = 0;
    while (!step.done) {
      if (step.value.phase === "demand") {
        expect(running === 0 || !step.value.options.includes("tier2")).toBe(true);
        if (step.value.options.includes("tier2")) running = athena.tiers[1].cost!.encounters!;
      }
      // 조우 하나가 지나면 기간이 하나 줄어든다 — 전투 밖의 칸은 세지 않는다
      if (step.value.phase === "reward" && running > 0) running -= 1;
      step = steps.next(step.value.phase === "demand" && step.value.options.includes("tier2") ? "tier2" : step.value.bot);
    }
  });

  it("evaluates a tier condition and reads the enemy count it needs", () => {
    expect(demandSatisfied(demands[0].tiers[1], { hit_targets_in_turn: 3 })).toBe(true);
    expect(demandSatisfied(demands[0].tiers[1], { hit_targets_in_turn: 2 })).toBe(false);
    // `target_spread`만 조우 크기를 요구한다 — 나머지 축은 요구의 하한을 그대로 쓴다
    expect(tierEnemies(demands[0].tiers[1].condition, 1)).toBe(3);
    expect(tierEnemies(athena.tiers[1].condition, 1)).toBe(1);
  });

  /**
   * 게이트 규칙 셋은 전부 **순서**만 잰다. 임계 단조는 픽스처 `14-demand-tier.json`이 지키고,
   * 나머지 둘을 여기서 잠근다 — 셋 다 같은 `demand_axis` 키다
   */
  it("rejects a tier ladder whose reward or cost runs backwards", () => {
    const ladder = (change: (demand: Demand) => void): Demand => {
      const copy = structuredClone(athena);
      change(copy);
      return copy;
    };
    // 쉬운 단이 더 주면 시련을 아무도 안 고른다
    const rewardBack = ladder((demand) => {
      demand.tiers[0].reward = { grace: 1 };
      demand.tiers[1].reward = { favor: 12 };
    });
    // 시련이 더 싸면 시련이 아니다
    const costBack = ladder((demand) => {
      demand.tiers[0].cost = { favor: 30, maxHp: 20, encounters: 4 };
    });
    // 기간 없는 최대 체력 대가는 조우 하나도 못 살고 걷힌다 — 죽은 데이터다
    const noDuration = ladder((demand) => {
      demand.tiers[1].cost = { favor: 18, maxHp: 8 };
    });
    for (const broken of [rewardBack, costBack, noDuration]) {
      expect(validateItems([broken as unknown as Record<string, unknown>]).rejected).toEqual([{ id: athena.id, failure: "demand_axis" }]);
    }
    expect(validateItems(demands as unknown as Record<string, unknown>[]).rejected).toEqual([]);
  });

  it("stratifies all ten pairings into the required penalty class", () => {
    const distribution = summarize(simulateStratified(100)).conflict_penalty_dist;
    expect(Object.keys(distribution)).toHaveLength(10);
    for (const [pairing, counts] of Object.entries(distribution)) {
      const expected = pairing.includes("artemis") ? "none" : ["zeus+poseidon", "athena+ares"].includes(pairing) ? "rival_18" : "non_rival_9";
      expect(counts).toEqual({ [expected]: 10 });
    }
  });
});

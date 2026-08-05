import { describe, expect, it } from "vitest";
import godData from "../data/gods.json" with { type: "json" };
import { demandPenalty, demandSatisfied, demandsConflict, pairKey, resolveDemand, rivals, type Demand } from "../core/demands";
import { demandReward, nonRivalDemandPenalty } from "../core/favor";
import { run, runSteps, simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";
import type { ReplayAction } from "../sim/replay";

const demand = (patron: string, polarity: "+" | "-"): Demand => ({
  id: patron,
  patron,
  condition: "hit_targets_in_turn >= 3",
  text: "셋을 쳐라",
  axis: "target_spread",
  polarity,
  min_enemies: 3,
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
    expect(resolveDemand(favor, "zeus", "poseidon", false)).toBeUndefined();
    expect(favor).toEqual({ zeus: 50, poseidon: 50 });
    expect(resolveDemand(favor, "zeus", "poseidon", true)).toBe("rival_18");
    expect(favor).toEqual({ zeus: 62, poseidon: 32 });
  });

  /**
   * `omen` 칸은 통째로 「신이 조건을 하나 더 건다」라 요구가 안 뜨면 눌러도 화면이 안 바뀐다.
   * 조용히 넘어가는 길이 둘 있었고 방문의 43.7%가 그랬다:
   *
   * - 제우스의 요구는 둘 다 적 둘 이상을 요구하는데 `omen`은 조우 크기를 모르니 1로 묻는다
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
     * 요구는 전투 **앞에서** 묻고 그 전투로 판정한다. P-27 이후로는 첫 결정이 갈래이고 1층은 적이
     * 하나라 제우스의 요구(적 둘 이상)가 아예 안 뜬다 — 그래서 「첫 요구」를 곡선이 **처음 갈라지는
     * 자리**로 찾는다. 그 자리까지 두 런은 같은 칸을 같은 시드로 걸었으므로 차이는 요구 하나다
     */
    const refuse: ReplayAction[] = [{ type: "demand", choice: "reject" }];
    /**
     * 시드 25 → 57 → 70 → 4 → 6 → 94: P-28이 요구를 두 신에 번갈아 걸면서(합성 전제가 「두 신의
     * 은혜」가 됐다) 6의 첫 요구가 상대 신 쪽으로 넘어갔다. 200시드 중 스물이 아래 단언 전부를
     * 만족하고 94가 가장 앞이다. 단언은 그대로다
     */
    const played = run(94);
    const refusedRun = run(94, undefined, refuse);
    // 두 곡선이 다 든 자리에서만 찾는다 — 거절 런이 먼저 죽으면 없는 칸이 「갈라진 자리」로 읽힌다
    const at = played.favorCurve.findIndex((point, index) => index < refusedRun.favorCurve.length
      && JSON.stringify(point) !== JSON.stringify(refusedRun.favorCurve[index]));
    expect(at, "seed 94 never diverges on the first demand").toBeGreaterThan(0);

    // 시드 94의 첫 요구는 지켜진다 — 보상과 상대 신의 벌금이 그때 들어간다
    const kept = played.favorCurve[at];
    const refused = refusedRun.favorCurve[at];
    expect(kept.zeus - refused.zeus).toBe(demandReward);
    expect(refused.athena - kept.athena).toBe(-nonRivalDemandPenalty);

    // 시드 2 → 3: 첫 요구를 수락해도 조건이 안 맞는다. 실패 벌금은 없으므로 거절과 결과가 같다 (R-5)
    expect(run(3).favorCurve).toEqual(run(3, undefined, refuse).favorCurve);

    // 편든 신은 "지킨 신"이다 — 전부 거절하면 상대 쪽으로 넘어간다
    const all: ReplayAction[] = Array.from({ length: 12 }, () => ({ type: "demand", choice: "reject" }));
    const rejected = run(94, undefined, all);
    expect(rejected.actions.filter(({ type }) => type === "demand").map(({ choice }) => choice)).toContain("reject");
    expect([played.conflictChoice, rejected.conflictChoice]).toEqual(["zeus", "athena"]);

    // 수락 대비 지킴 비율이 실제로 1이 아니다 — 조건 판정이 걸린다는 증거다
    const outcome = played.demandOutcomes.demand_zeus_solo;
    expect(outcome, "demand_zeus_solo not asked in seed 94").toBeDefined();
    const [accepted, keptCount] = outcome;
    expect(keptCount).toBeGreaterThan(0);
    expect(keptCount).toBeLessThan(accepted);
  });

  it("detects rival conflicts and evaluates conditions", () => {
    expect(demandsConflict(demand("zeus", "+"), demand("poseidon", "-"))).toBe(true);
    expect(demandsConflict(demand("zeus", "+"), demand("athena", "-"))).toBe(false);
    expect(demandSatisfied(demand("zeus", "+"), { hit_targets_in_turn: 3 })).toBe(true);
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

import { describe, expect, it } from "vitest";
import godData from "../data/gods.json" with { type: "json" };
import { demandPenalty, demandSatisfied, demandsConflict, pairKey, resolveDemand, rivals, type Demand } from "../core/demands";
import { demandReward, nonRivalDemandPenalty } from "../core/favor";
import { run, simulateStratified } from "../sim/engine";
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

  it("pays a demand only when the fight actually satisfied it", () => {
    // 요구는 전투 **앞에서** 묻고 그 전투로 판정한다. 두 시드 모두 첫 결정이 요구이므로
    // favorCurve[1]의 차이는 그 요구 하나가 만든 것이다
    const refuse: ReplayAction[] = [{ type: "demand", choice: "reject" }];

    // 시드 5의 첫 요구는 지켜진다 — 보상과 상대 신의 벌금이 그때 들어간다
    const kept = run(5).favorCurve[1];
    const refused = run(5, undefined, refuse).favorCurve[1];
    expect(kept.zeus - refused.zeus).toBe(demandReward);
    expect(refused.athena - kept.athena).toBe(-nonRivalDemandPenalty);

    // 시드 1의 첫 요구는 수락해도 조건이 안 맞는다. 실패 벌금은 없으므로 거절과 결과가 같다 (R-5)
    expect(run(1).favorCurve[1]).toEqual(run(1, undefined, refuse).favorCurve[1]);

    // 편든 신은 "지킨 신"이다 — 전부 거절하면 상대 쪽으로 넘어간다
    const all: ReplayAction[] = Array.from({ length: 12 }, () => ({ type: "demand", choice: "reject" }));
    const rejected = run(5, undefined, all);
    expect(rejected.actions.filter(({ type }) => type === "demand").map(({ choice }) => choice)).toContain("reject");
    expect([run(5).conflictChoice, rejected.conflictChoice]).toEqual(["zeus", "athena"]);

    // 수락 대비 지킴 비율이 실제로 1이 아니다 — 조건 판정이 걸린다는 증거다
    const [accepted, keptCount] = run(5).demandOutcomes.demand_zeus_solo;
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

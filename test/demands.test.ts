import { describe, expect, it } from "vitest";
import { demandPenalty, demandSatisfied, demandsConflict, resolveDemand, type Demand } from "../core/demands";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

const demand = (patron: string, polarity: "+" | "-"): Demand => ({
  id: patron,
  patron,
  condition: "hit_targets_in_turn >= 3",
  axis: "target_spread",
  polarity,
  min_enemies: 3,
});

describe("demands", () => {
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

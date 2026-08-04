import { demandReward, nonRivalDemandPenalty, rivalDemandPenalty, shiftFavor } from "./favor.ts";

export const demandAxes = ["target_spread", "damage_taken", "turn_economy", "token_load"] as const;
export type DemandAxis = (typeof demandAxes)[number];
export type PenaltyKey = "rival_18" | "non_rival_9" | "none";
export type Demand = {
  id: string;
  patron: string;
  condition: string;
  axis: DemandAxis;
  polarity: "+" | "-";
  min_enemies: number;
};

const rivals = new Set(["poseidon:zeus", "ares:athena"]);
const pairKey = (left: string, right: string) => [left, right].sort().join(":");

export function demandPenalty(patron: string, other: string): { amount: number; key: PenaltyKey } {
  if (patron === "artemis" || other === "artemis") return { amount: 0, key: "none" };
  if (rivals.has(pairKey(patron, other))) return { amount: rivalDemandPenalty, key: "rival_18" };
  return { amount: nonRivalDemandPenalty, key: "non_rival_9" };
}

export function resolveDemand(favor: Record<string, number>, patron: string, other: string, satisfied: boolean): PenaltyKey | undefined {
  if (!satisfied) return undefined;
  shiftFavor(favor, patron, demandReward);
  const penalty = demandPenalty(patron, other);
  shiftFavor(favor, other, penalty.amount);
  return penalty.key;
}

export function demandsConflict(left: Demand, right: Demand): boolean {
  return rivals.has(pairKey(left.patron, right.patron)) && left.axis === right.axis && left.polarity !== right.polarity;
}

export function demandSatisfied(demand: Demand, facts: Record<string, number>): boolean {
  const match = demand.condition.match(/^([a-z_]+) (>=|<=|>|==) (\d+)$/);
  if (!match || !(match[1] in facts)) throw new Error(`Invalid demand condition: ${demand.condition}`);
  const [left, right] = [facts[match[1]], Number(match[3])];
  if (match[2] === ">=") return left >= right;
  if (match[2] === "<=") return left <= right;
  if (match[2] === ">") return left > right;
  return left === right;
}

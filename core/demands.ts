import { nonRivalDemandPenalty, rivalDemandPenalty, shiftFavor } from "./favor.ts";

export const demandAxes = ["target_spread", "damage_taken", "turn_economy", "token_load"] as const;
export type DemandAxis = (typeof demandAxes)[number];
export type PenaltyKey = "rival_18" | "non_rival_9" | "none";
/** 지키면 들어오는 것. **호의 하나뿐이다** — 카드 보상은 엔진이 과업 보상으로 고정한다 */
export type DemandReward = { favor: number };
/**
 * 신 하나가 내는 과업 조건 하나. 과업 노드는 후원 신 둘 중 하나를 고른다.
 */
export type Demand = {
  id: string;
  patron: string;
  axis: DemandAxis;
  polarity: "+" | "-";
  min_enemies: number;
  /** 화면에 나가는 문장이고 `condition`은 사람이 읽을 것이 아니다 — `ruleText`가 읽을 것을 만든다 */
  text: string;
  condition: string;
  reward: DemandReward;
};
/**
 * 화면과 봇이 한 제안을 읽는 꼴. `action`이 곧 답이다(신 id) — 설 수 없는 조건은 여기 없다.
 * `rule`은 `text` **아래에** 서는 줄이다(둘을 합치는 것은 아래 `ruleText`가 막는 것이다)
 */
export type DemandOffer = { action: string; god: string; other: string; text: string; rule: string; reward: DemandReward; penalty: number };

/**
 * core는 data/*.json을 읽지 않는다(호출자가 넘긴다). 이 한 벌만 예외로 상수인데, demandPenalty를
 * 부르는 모든 자리에 신 데이터를 실어보내는 것보다 싸다 — data/gods.json과 같은지는 테스트가 고정한다
 */
export const rivals = new Set(["poseidon:zeus", "ares:athena"]);
export const pairKey = (left: string, right: string) => [left, right].sort().join(":");

/**
 * 그 조건이 서려면 조우에 적이 몇 있어야 하는가. `target_spread`의 `>=`만 조우 크기를 요구하고 나머지는
 * 과업의 하한을 그대로 쓴다 — 게이트(`demandFailure`)와 엔진이 같은 한 줄을 읽는다
 */
export const demandEnemies = (condition: string, fallback: number): number =>
  Number(condition.match(/hit_targets_in_turn >= (\d+)/)?.[1] ?? fallback);

export function demandPenalty(patron: string, other: string): { amount: number; key: PenaltyKey } {
  if (patron === "artemis" || other === "artemis") return { amount: 0, key: "none" };
  if (rivals.has(pairKey(patron, other))) return { amount: rivalDemandPenalty, key: "rival_18" };
  return { amount: nonRivalDemandPenalty, key: "non_rival_9" };
}

/**
 * 편을 드는 순간 **상대는 이미 기분이 상한다.** 선불이라 지키든 못 지키든 이미 나간 값이고, 그래서
 * 과업을 고르는 결정이 된다. 지나가면 아무 편도 안 들었으므로 이 줄도 없다.
 */
export function takeSide(favor: Record<string, number>, patron: string, other: string): PenaltyKey {
  const penalty = demandPenalty(patron, other);
  shiftFavor(favor, other, penalty.amount);
  return penalty.key;
}

/**
 * 지킨 조건만 넘어온다(`reward`가 없으면 관망이거나 못 지킨 것이다) — 지키지 못한 약속은 아무것도
 * 주지 않는다. 실패 벌금은 만들지 않는다 (R-5).
 */
export function resolveDemand(favor: Record<string, number>, patron: string, reward?: DemandReward): void {
  if (reward?.favor) shiftFavor(favor, patron, reward.favor);
}

/**
 * 조건의 좌변이 쓸 수 있는 사실 다섯과 그 한글 이름. **게이트가 이 표를 읽는다**(`tools/validate.ts`) —
 * 없는 좌변을 쓰는 요구는 반려된다. 지금까지는 오타 하나가 조용히 통과했고 화면에서 빈 줄이 됐다.
 * `turns`는 제우스의 「제한 턴 안에 승리」가 여는 자리다 (P-59)
 */
export const factName: Record<string, string> = {
  hit_targets_in_turn: "한 턴에 맞힌 적",
  damage_taken: "이 조우에서 잃은 체력",
  tokens_applied: "새긴 토큰",
  tokens_applied_in_turn: "한 턴에 새긴 토큰",
  turns: "이 조우에 쓴 턴",
};
const compareName: Record<string, string> = { ">=": "이상", "<=": "이하", ">": "초과", "==": "같음" };
const conditionPattern = /^([a-z_]+) (>=|<=|>|==) (\d+)$/;
export type DemandCondition = { fact: string; compare: string; target: number };

/** 조건 문자열의 정본 파서. `demandSatisfied`·`ruleText`·`demandSettled` 셋이 같은 한 줄을 읽는다 */
export function parseCondition(condition: string): DemandCondition {
  const match = condition.match(conditionPattern);
  if (!match) throw new Error(`Invalid demand condition: ${condition}`);
  return { fact: match[1], compare: match[2], target: Number(match[3]) };
}

/**
 * 조건을 사람 말로. **신의 문장을 대신하지 않고 아래에 붙는다** — 시적인 문장은 신의 목소리고
 * 이 줄은 규칙이다. 둘을 합치면 신이 숫자를 읽는 소리가 되고, 그러면 대사의 목소리가 죽는다
 */
export function ruleText(condition: string): string {
  const { fact, compare, target } = parseCondition(condition);
  // 폴백이 없다 — 정규식이 비교자 넷만 통과시키고 게이트가 `factName` 밖 좌변을 반려한다
  return `${factName[fact]} ${target} ${compareName[compare]}`;
}

/**
 * 조건이 **확정됐는가.** 요구가 재는 사실 다섯은 전부 단조 비감소다(`sim/engine.ts`의 `+=`·`Math.max`) —
 * 그래서 달성형(`>=`·`>`)은 처음 넘는 순간 성공이 굳어 다시는 깨질 수 없고, 유지형(`<=`)은 처음
 * 넘는 순간 실패가 굳는다. 상태를 하나도 안 만들고 진행 막대와 성공·실패 알림이 둘 다 여기서 나온다.
 *
 * **`polarity`로 가르지 않는다** — 아레스의 `damage_taken > 14`는 `+`이고 아테나의 `damage_taken <= 20`은
 * `-`인데, 가르는 것은 신의 취향이 아니라 비교 연산자다. `==`는 양쪽 다 아니라 끝까지 미정이다
 */
export function demandSettled(condition: string, facts: Record<string, number>): "kept" | "broken" | undefined {
  const { compare } = parseCondition(condition);
  if (compare === "==") return undefined;
  const held = demandSatisfied(condition, facts);
  if (compare === "<=") return held ? undefined : "broken";
  return held ? "kept" : undefined;
}

export function demandSatisfied(condition: string, facts: Record<string, number>): boolean {
  const { fact, compare, target } = parseCondition(condition);
  if (!(fact in facts)) throw new Error(`Invalid demand condition: ${condition}`);
  const left = facts[fact];
  if (compare === ">=") return left >= target;
  if (compare === "<=") return left <= target;
  if (compare === ">") return left > target;
  return left === target;
}

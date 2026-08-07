import { nonRivalDemandPenalty, rivalDemandPenalty, shiftFavor } from "./favor.ts";
import type { GameState } from "./state.ts";

export const demandAxes = ["target_spread", "damage_taken", "turn_economy", "token_load"] as const;
export type DemandAxis = (typeof demandAxes)[number];
export type PenaltyKey = "rival_18" | "non_rival_9" | "none";
/**
 * 선불 대가. 값은 **크기**다(부호 없음) — 단조 검사가 필드별 `≤` 하나로 서고, 호의·최대 체력을 한
 * 눈금으로 바꾸는 상수를 만들지 않아도 된다. `maxHp`는 `encounters` 조우 동안 붙는다
 */
export type DemandCost = { favor?: number; maxHp?: number; encounters?: number };
/** 서열은 사전식 한 줄이다 — 은혜 > 업그레이드 > 호의(`tools/validate.ts`의 `rewardRises`) */
export type DemandReward = { favor?: number; grace?: number; upgrade?: number };
/** 한 단. `text`가 화면에 나가는 문장이고 `condition`은 사람이 읽을 것이 아니다 */
export type DemandTier = { text: string; condition: string; cost?: DemandCost; reward: DemandReward };
export type Demand = {
  id: string;
  patron: string;
  axis: DemandAxis;
  polarity: "+" | "-";
  min_enemies: number;
  /** 둘이다 — 수락과 시련. 가운데를 끼우는 것은 두 단이 실제로 갈린 뒤의 일이다 (P-29) */
  tiers: [DemandTier, DemandTier];
};
/** 화면과 봇이 한 단을 읽는 꼴. `action`이 곧 답이다 — 제안되지 않은 단은 여기 없다 */
export type DemandOffer = { action: string; text: string; cost?: DemandCost; reward: DemandReward };

/**
 * core는 data/*.json을 읽지 않는다(호출자가 넘긴다). 이 한 벌만 예외로 상수인데, demandPenalty를
 * 부르는 모든 자리에 신 데이터를 실어보내는 것보다 싸다 — data/gods.json과 같은지는 테스트가 고정한다
 */
export const rivals = new Set(["poseidon:zeus", "ares:athena"]);
export const pairKey = (left: string, right: string) => [left, right].sort().join(":");

/**
 * 그 단이 서려면 조우에 적이 몇 있어야 하는가. `target_spread`의 `>=`만 조우 크기를 요구하고 나머지는
 * 요구의 하한을 그대로 쓴다 — 게이트(`demandFailure`)와 엔진(`askDemand`)이 같은 한 줄을 읽는다
 */
export const tierEnemies = (condition: string, fallback: number): number =>
  Number(condition.match(/hit_targets_in_turn >= (\d+)/)?.[1] ?? fallback);

export function demandPenalty(patron: string, other: string): { amount: number; key: PenaltyKey } {
  if (patron === "artemis" || other === "artemis") return { amount: 0, key: "none" };
  if (rivals.has(pairKey(patron, other))) return { amount: rivalDemandPenalty, key: "rival_18" };
  return { amount: nonRivalDemandPenalty, key: "non_rival_9" };
}

/**
 * 선불 대가를 **지금** 치른다 — 지키든 못 지키든 이미 나간 값이고, 그래서 요구가 수락/거절이 아니라
 * 계산이 된다(하데스의 카오스: 저주를 먼저 쓰고 축복은 나중에 온다).
 *
 * `maxHp`는 런 상태다 — `playEncounter`가 조우마다 이어 받고, 기간이 끝나면 엔진이 되돌린다.
 * 되돌아오는 것은 **여유뿐이고 체력은 아니다**. 호의는 상대 신에게서 깎는다: 아르테미스는 `rivals`가
 * 비어 `demandPenalty`가 0이라 지키는 쪽으로는 공짜인데, 선불은 관계표를 타지 않으므로 여기서 걸린다
 */
export function payDemandCost(state: GameState, other: string, cost: DemandCost): void {
  if (cost.favor) shiftFavor(state.favor, other, -cost.favor);
  if (cost.maxHp) {
    state.combat.player.maxHp = Math.max(1, state.combat.player.maxHp - cost.maxHp);
    state.combat.player.hp = Math.min(state.combat.player.hp, state.combat.player.maxHp);
  }
}

/**
 * 지킨 단만 넘어온다(`tier`가 없으면 거절이거나 못 지킨 것이다) — 지키지 못한 약속은 아무것도 움직이지
 * 않는다. 실패 벌금은 만들지 않는다 (R-5). 은혜 보상은 3택1을 띄워야 하므로 엔진이 든다
 */
export function resolveDemand(favor: Record<string, number>, patron: string, other: string, tier?: DemandTier): PenaltyKey | undefined {
  if (!tier) return undefined;
  if (tier.reward.favor) shiftFavor(favor, patron, tier.reward.favor);
  const penalty = demandPenalty(patron, other);
  shiftFavor(favor, other, penalty.amount);
  return penalty.key;
}

export function demandSatisfied(tier: DemandTier, facts: Record<string, number>): boolean {
  const match = tier.condition.match(/^([a-z_]+) (>=|<=|>|==) (\d+)$/);
  if (!match || !(match[1] in facts)) throw new Error(`Invalid demand condition: ${tier.condition}`);
  const [left, right] = [facts[match[1]], Number(match[3])];
  if (match[2] === ">=") return left >= right;
  if (match[2] === "<=") return left <= right;
  if (match[2] === ">") return left > right;
  return left === right;
}

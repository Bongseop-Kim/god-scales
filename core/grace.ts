import type { Effect, GodId } from "./rules.ts";

/**
 * 은혜가 붙는 슬롯. 카드 태그를 그대로 쓴다 — 은혜는 카드 **한 장**이 아니라 그 태그의 **모든 카드**에
 * 붙는다. 하데스의 「공격 보온이 카드 한 장이 아니라 공격 행동 전체를 바꾼다」와 같은 자리다.
 *
 * `multi`는 슬롯이 아니다: 덱에 평균 1.06장(600런 실측)이라 은혜 한 칸이 카드 한 장에 붙고, 그건
 * P-28이 걷어낸 옛 마일스톤과 같은 것이다. 게다가 `chain`은 대상 enemy를 요구하므로(`loadCards`)
 * 광역 카드에 붙으면 낼 때마다 던진다
 */
export const graceSlots = ["attack", "defend", "utility", "token"] as const;
export type GraceSlot = (typeof graceSlots)[number];

/**
 * tier 사다리. 한 숫자가 등급이자 레벨이다 — 그 신에게서 받은 은혜 수가 곧 다음 은혜의 세기고,
 * 세기가 곧 그것이 뜰 수 있는 시점이다. 두 뜻이 겹쳐도 모순이 없어서 다이얼을 둘 두지 않는다
 */
export const graceMilestones = [2, 4, 6] as const;

export type Grace = { id: string; patron: GodId; slot: GraceSlot; tier: number; text: string; effects: Effect[] };
/** 슬롯당 하나. `effects`를 같이 든다 — `cardEffects`가 카드를 낼 때마다 데이터를 다시 찾지 않는다 */
export type GraceHeld = Partial<Record<GraceSlot, { id: string; tier: number; effects: Effect[] }>>;

/** 그 신에게서 은혜를 몇 개 받았는가 → 다음 은혜의 tier. 마일스톤 아래는 최저 tier다 */
export function graceTier(earned: number): number {
  return [...graceMilestones].reverse().find((milestone) => earned >= milestone) ?? graceMilestones[0];
}

/**
 * 3택1. 후보는 그 신의 은혜 중 이 tier의 줄이고 **빈 슬롯이 먼저** 선다 — 하데스가 핵심 슬롯 보온을
 * 먼저 제안하는 자리다.
 *
 * ponytail: 신당 설계가 셋이라 셋이 다 뜬다 — 시드를 당기지 않는다. 뽑기 스트림을 하나 더 만들면
 * 은혜를 켜는 것만으로 기존 재생이 통째로 어긋난다. 설계가 넷 이상 되면 그때 뽑는다
 */
export function graceOffer(graces: Grace[], god: string, held: GraceHeld, tier: number): Grace[] {
  return graces
    .filter((grace) => grace.patron === god && grace.tier === tier)
    .sort((left, right) => Number(Boolean(held[left.slot])) - Number(Boolean(held[right.slot])) || (left.id < right.id ? -1 : 1))
    .slice(0, 3);
}

/**
 * 슬롯에 놓는다. **tier는 슬롯의 것이다** — 교체해도 내려가지 않는다(하데스의 석류 승계 그대로).
 * 두 신의 은혜 수가 따로 오르므로 실제로 걸린다: 아테나 은혜 넷을 받아 tier 4인 방어 슬롯에
 * 제우스의 첫 은혜(tier 2)를 놓으면 그 은혜가 tier 4 줄로 들어온다
 */
export function takeGrace(graces: Grace[], held: GraceHeld, grace: Grace): void {
  const tier = Math.max(grace.tier, held[grace.slot]?.tier ?? 0);
  const row = graces.find((candidate) => candidate.id === grace.id && candidate.tier === tier);
  if (!row) throw new Error(`${grace.id}: no tier ${tier} row`);
  held[grace.slot] = { id: row.id, tier, effects: row.effects };
}

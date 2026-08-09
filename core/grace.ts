import type { Effect, GodId } from "./rules.ts";

export const graceMilestones = [2, 4, 6] as const;
export type Grace = { id: string; patron: GodId; tier: number; text: string; effects: Effect[] };

export function graceTier(earned: number): number {
  return [...graceMilestones].reverse().find((milestone) => earned >= milestone) ?? graceMilestones[0];
}

/** 신과 획득 시점의 tier만 본다. 배포 설계가 셋이라 별도 RNG는 필요 없다. */
export function graceOffer(graces: Grace[], god: string, tier: number): Grace[] {
  return graces.filter((grace) => grace.patron === god && grace.tier === tier).slice(0, 3);
}

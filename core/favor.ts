import type { ActorState, GameState, TokenName } from "./state.ts";

export const favorInitial = 50;
export const favorDecayPerEncounter = -3;
export const favorNeglectPenalty = -2;
export const demandReward = 12;
export const rivalDemandPenalty = -18;
export const nonRivalDemandPenalty = -9;
export const favorBoundaries = { devotion: 70, calm: 30, anger: 10, wrath: 0 } as const;
export const graceMilestones = [2, 4, 6] as const;
/** v3: shock·soaked·mark·frenzy 구현, deflect/displace/bulwark 재가격, 헌신·진노 오라 연결, baseCardBalance 0 */
export const globalParamVersion = "v3";

export type FavorStage = keyof typeof favorBoundaries;
export type FavorUses = Record<string, number>;
type StageEffect = { op: "apply_token"; token: TokenName; stacks: number; target: "self" | "enemy" | "all_enemies" };
export type FavorGod = { id: string; stage_effects: { devotion?: { on_encounter_start: StageEffect }; wrath?: { on_encounter_start: StageEffect } } };

export function favorStage(value: number): FavorStage {
  if (value >= favorBoundaries.devotion) return "devotion";
  if (value >= favorBoundaries.calm) return "calm";
  if (value >= favorBoundaries.anger) return "anger";
  return "wrath";
}

export function shiftFavor(favor: Record<string, number>, god: string, amount: number): number {
  favor[god] = Math.max(0, Math.min(100, (favor[god] ?? favorInitial) + amount));
  return favor[god];
}

export function recordCardFavor(favor: Record<string, number>, god: string, uses: FavorUses): void {
  uses[god] = (uses[god] ?? 0) + 1;
  if (uses[god] <= 5) shiftFavor(favor, god, 1);
}

export function finishCombatFavor(favor: Record<string, number>, patrons: string[], uses: FavorUses): void {
  for (const god of patrons) shiftFavor(favor, god, favorDecayPerEncounter + ((uses[god] ?? 0) === 0 ? favorNeglectPenalty : 0));
}

export function finishRestFavor(favor: Record<string, number>, patrons: string[]): void {
  for (const god of patrons) shiftFavor(favor, god, favorDecayPerEncounter);
}

function targets(state: GameState, target: StageEffect["target"]): ActorState[] {
  if (target === "self") return [state.combat.player];
  const enemies = state.combat.enemies.filter(({ hp }) => hp > 0);
  return target === "enemy" ? enemies.slice(0, 1) : enemies;
}

export function applyFavorStageEffects(state: GameState, definitions: FavorGod[]): void {
  for (const god of definitions) {
    const stage = favorStage(state.favor[god.id] ?? favorInitial);
    if (stage !== "devotion" && stage !== "wrath") continue;
    const effect = god.stage_effects[stage]?.on_encounter_start;
    if (!effect) continue;
    const stacks = effect.stacks + (stage === "devotion" && (state.grace[god.id] ?? 0) >= 4 ? 1 : 0);
    for (const actor of targets(state, effect.target)) {
      actor.tokens[effect.token] = (actor.tokens[effect.token] ?? 0) + stacks;
    }
  }
}

export function awardGrace(favor: Record<string, number>, grace: Record<string, number>, patrons: string[]): string | undefined {
  const devoted = patrons.filter((god) => favorStage(favor[god] ?? favorInitial) === "devotion");
  if (devoted.length !== 1) return undefined;
  const god = devoted[0];
  grace[god] = Math.min(6, (grace[god] ?? 0) + 1);
  return god;
}

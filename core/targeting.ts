import type { ActorState, CombatState } from "./state.ts";

export type Target = "self" | "enemy" | "all_enemies";

export function resolveTargets(
  combat: CombatState,
  target: Target,
  enemyId?: string,
): ActorState[] {
  if (target === "self") return [combat.player];
  if (target === "all_enemies") return combat.enemies.filter((enemy) => enemy.hp > 0);

  const enemy = combat.enemies.find((candidate) => candidate.id === enemyId && candidate.hp > 0);
  if (!enemy) throw new Error(`Unknown living enemy: ${enemyId ?? "none"}`);
  return [enemy];
}

export function resolveChainTargets(combat: CombatState, primaryId: string): ActorState[] {
  return combat.enemies.filter((enemy) => enemy.hp > 0 && enemy.id !== primaryId);
}

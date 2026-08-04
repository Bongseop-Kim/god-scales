import type { Card } from "../core/rules.ts";
import type { CombatState } from "../core/state.ts";

export function renderPlay(combat: CombatState, card: Card, targetId?: string): string {
  const target = targetId ? combat.enemies.find(({ id }) => id === targetId) : combat.player;
  const effects = card.effects.map(({ op, value, token, stacks }) =>
    op === "apply_token" ? `${token}:${stacks ?? 1}` : `${op}:${value ?? 0}`,
  ).join(",");
  const tokens = Object.entries(target?.tokens ?? {}).map(([token, count]) => `${token}:${count}`).join(",") || "none";
  return `turn=${combat.turn} card=${card.id} target=${target?.id ?? "none"} effects=${effects} target_hp=${target?.hp ?? 0} tokens=${tokens}`;
}

import type { EnemyDefinition } from "../../core/combat.ts";
import type { Card } from "../../core/rules.ts";
import type { CombatState } from "../../core/state.ts";

function intent(combat: CombatState, definitions: ReadonlyMap<string, EnemyDefinition>): number {
  return combat.enemies.reduce((total, enemy) => {
    if (enemy.hp <= 0 || (enemy.tokens.displace ?? 0) > 0) return total;
    const pattern = definitions.get(enemy.id)?.pattern;
    return total + (pattern?.[enemy.patternIndex % pattern.length]?.damage ?? 0);
  }, 0);
}

function cardValue(card: Card, combat: CombatState, incoming: number): number {
  const living = combat.enemies.filter(({ hp }) => hp > 0).length;
  let value = 0;
  for (const effect of card.effects) {
    const amount = effect.value ?? effect.stacks ?? 0;
    if (effect.op === "damage") value += amount * (card.target === "all_enemies" ? living : 1);
    else if (effect.op === "chain") value += amount * Math.max(0, living - 1);
    else if (effect.op === "block") value += Math.min(amount, Math.max(0, incoming - combat.player.block));
    else if (effect.op === "heal") value += amount;
    else if (effect.op === "draw") value += amount * 1.5;
    else if (effect.op === "energy") value += amount * 2;
    else if (effect.op === "apply_token") value += amount * 4;
    else if (effect.op === "self_damage") value -= amount;
  }
  return card.tags.includes("exhaust") ? value * 0.6 : value;
}

export function chooseCard(
  combat: CombatState,
  cards: ReadonlyMap<string, Card>,
  definitions: ReadonlyMap<string, EnemyDefinition>,
): string | undefined {
  const incoming = intent(combat, definitions);
  const affordable = combat.hand.filter((id) => (cards.get(id)?.cost ?? Infinity) <= combat.energy);
  return affordable.sort((left, right) => {
    const a = cards.get(left)!;
    const b = cards.get(right)!;
    if (incoming >= combat.player.hp) {
      const block = (card: Card) => card.effects.reduce((sum, effect) => sum + (effect.op === "block" ? effect.value ?? 0 : 0), 0);
      const defense = block(b) - block(a);
      if (defense !== 0) return defense;
    }
    return cardValue(b, combat, incoming) - cardValue(a, combat, incoming);
  })[0];
}

export function chooseTarget(
  card: Card,
  combat: CombatState,
  definitions: ReadonlyMap<string, EnemyDefinition>,
): string | undefined {
  if (card.target !== "enemy") return undefined;
  const damage = card.effects.reduce((sum, effect) => sum + (effect.op === "damage" ? effect.value ?? 0 : 0), 0);
  return [...combat.enemies]
    .filter(({ hp }) => hp > 0)
    .sort((a, b) => {
      const aKill = a.hp <= damage ? 1 : 0;
      const bKill = b.hp <= damage ? 1 : 0;
      if (aKill !== bKill) return bKill - aKill;
      if (aKill) {
        const enemyIntent = (id: string, index: number) => {
          const pattern = definitions.get(id)?.pattern;
          return pattern?.[index % pattern.length]?.damage ?? 0;
        };
        const intentDifference = enemyIntent(b.id, b.patternIndex) - enemyIntent(a.id, a.patternIndex);
        if (intentDifference !== 0) return intentDifference;
      }
      return a.hp - b.hp;
    })[0]?.id;
}

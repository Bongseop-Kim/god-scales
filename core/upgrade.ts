import type { Card } from "./rules.ts";

const boostedOps = new Set(["damage", "block", "draw", "heal"]);

export function upgradeCard(card: Card): Card {
  if (card.upgraded) return card;
  return {
    ...card,
    upgraded: true,
    effects: card.effects.map((effect) => ({
      ...effect,
      value: effect.value !== undefined && boostedOps.has(effect.op) ? Math.ceil(effect.value * 1.5) : effect.value,
      stacks: effect.stacks !== undefined ? Math.ceil(effect.stacks * 1.5) : effect.stacks,
    })),
  };
}

export function reduceCardCost(card: Card): Card {
  return { ...card, cost: Math.max(0, card.cost - 1) };
}

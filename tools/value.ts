type Effect = { op: string; value?: number; stacks?: number; when?: string };
type Card = { cost: number; target: string; effects: Effect[]; tags: string[]; patron_pair?: string[] };

const tokenWeights: Record<string, number> = {
  shock: 1,
  displace: 2.5,
  soaked: 0.8,
  bulwark: 1,
  deflect: 2,
  bleed: 1.5,
  frenzy: 1.5,
  mark: 2,
  crit: 3,
};

export function expectedValue(card: Card, averageEnemies = 2, conditionRate = 0.5): number {
  let value = 0;
  for (const effect of card.effects) {
    const multiplier = effect.when ? conditionRate : 1;
    const targets = card.target === "all_enemies" && ["damage", "apply_token"].includes(effect.op) ? averageEnemies : 1;
    const amount = effect.value ?? 0;
    const weights: Record<string, number> = {
      damage: amount,
      chain: amount * (averageEnemies - 1),
      block: amount * 0.8,
      draw: amount * 2.5,
      energy: amount * 3,
      heal: amount * 0.7,
      self_damage: amount * -1.2,
    };
    value += (effect.op === "apply_token" ? tokenWeights[(effect as Effect & { token?: string }).token ?? ""] * (effect.stacks ?? 1) : weights[effect.op] ?? 0) * multiplier * targets;
  }
  if (card.tags.includes("exhaust")) value *= 0.6;
  return value / Math.max(card.cost, 0.5);
}

export function isValueAllowed(card: Card): boolean {
  const value = expectedValue(card);
  const [minimum, maximum] = card.patron_pair ? [6, 10] : [4, 8];
  return value >= minimum && value <= maximum;
}

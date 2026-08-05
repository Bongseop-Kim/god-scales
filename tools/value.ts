type Effect = { op: string; value?: number; stacks?: number; when?: string };
type Card = { cost: number; target: string; effects: Effect[]; tags: string[]; patron_pair?: string[] };

/** 게이트가 카드를 재는 무게다. 봇의 `cardValue`도 같은 표를 쓴다 — 두 번째 진실을 만들지 않는다 */
export const tokenWeights: Record<string, number> = {
  shock: 1,
  // 적의 한 턴을 통째로 지운다. 적 공격 한 방이 지금 6~10이므로 2.5는 서너 배 싼값이었다
  displace: 6,
  soaked: 0.8,
  // 턴마다 0으로 돌아가는 block과 달리 전투 끝까지 남는다. 같은 값에 0.8/1.0은 block을 쓸 이유를 없앴다
  bulwark: 2.5,
  // 한 방을 막고 그 피해를 그대로 되돌린다 — 막은 값 + 준 값이라 displace의 두 배다
  deflect: 10,
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

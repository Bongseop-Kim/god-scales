type Effect = { op: string; value?: number; token?: string; stacks?: number; when?: string };
type Card = { cost: number; target: string; effects: Effect[]; tags: string[]; patron_pair?: string[]; tier?: number };

/** 게이트가 카드를 재는 무게다. 봇의 `cardValue`도 같은 표를 쓴다 — 두 번째 진실을 만들지 않는다 */
export const tokenWeights: Record<string, number> = {
  shock: 1,
  // 적의 한 턴을 통째로 지운다. 적 공격 한 방이 지금 6~10이므로 2.5는 서너 배 싼값이었다
  displace: 6,
  // 정직한 값은 0.903인데 0.9로 올리면 포세이돈 pool_ratio가 상한을 넘는다 — reviews/25-enemies.md §2
  soaked: 0.8,
  // 턴마다 0으로 돌아가는 block과 달리 전투 끝까지 남는다. 같은 값에 0.8/1.0은 block을 쓸 이유를 없앴다
  bulwark: 2.5,
  // 한 방을 막고 그 피해를 그대로 되돌린다 — 막은 값 + 준 값이라 displace의 두 배다
  deflect: 10,
  bleed: 1.5,
  frenzy: 1.5,
  mark: 2,
  crit: 3,
  /**
   * 상시 반격. 조우 7턴 중반에 붙으면 3~4턴이 남고 살아 있는 적이 1~2라 스택당 **4~8회** 발동한다.
   * 하한을 값으로 쓴다 — 되돌린 피해가 `dealDamage`를 타므로 상대의 `angry`를 깨우고, 그 손해는
   * 이 표가 세지 못한다. 완화가 아니므로 `mitigationTokens`에는 넣지 않는다(받는 피해를 줄이지 않는다)
   */
  thorns: 4,
  /**
   * 스택마다 주는 피해 +1이고 **소모되지 않는다**. 중반 부착 시 남은 3턴 × 공격 1~2회의 **하한**을
   * 쓴다 — `thorns = 4`와 같은 논리다. 광란(+2 1회)과의 경계가 소모 여부이므로 무게도 그 위에 선다
   */
  might: 3,
  // 다음 턴 에너지·뽑기를 스택만큼 깎는다. `expectedValue`의 `energy: ×3`·`draw: ×2.5`를 그대로 뒤집은
  // 값이다 — 빼앗은 자원과 받은 자원이 다른 눈금이면 편성 세기가 카드 값과 비교 불가능해진다
  drain: 3,
  fog: 2.5,
};

/** 파워가 일하는 턴 수. `expectedValue`는 효과를 한 번 세므로 곱한다. 4에서 3으로 내린 사유는 reviews/31-powers.md */
export const powerTurns = 3;

/** 맞는 값을 줄이는 데 쓴 기대값. `block`과 이 네 토큰이 전부다 */
export const mitigationTokens = new Set(["bulwark", "deflect", "displace", "soaked"]);
const isMitigation = (effect: Effect) => effect.op === "block" || (effect.op === "apply_token" && mitigationTokens.has(effect.token ?? ""));

export function expectedValue(card: Card, averageEnemies = 2, conditionRate = 0.5, keep: (effect: Effect) => boolean = () => true): number {
  let value = 0;
  for (const effect of card.effects) {
    if (!keep(effect)) continue;
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
    value += (effect.op === "apply_token" ? tokenWeights[effect.token ?? ""] * (effect.stacks ?? 1) : weights[effect.op] ?? 0) * multiplier * targets;
  }
  if (card.tags.includes("power")) value *= powerTurns;
  if (card.tags.includes("exhaust")) value *= 0.6;
  return value / Math.max(card.cost, 0.5);
}

/** 같은 눈금이어야 비율이 뜻을 갖는다 — `expectedValue`의 분모·소진 보정을 그대로 탄다 */
export const mitigationValue = (card: Card): number => expectedValue(card, 2, 0.5, isMitigation);

/** 은혜 하나가 카드 한 장에 더하는 값. 봇의 3택 정렬에만 쓴다. */
export const graceValue = (effects: Effect[]): number => expectedValue({ cost: 1, target: "enemy", effects, tags: [] });

/**
 * 값의 계단. **반개구간이라 경계값이 한쪽에만 든다** — 겹치던 옛 밴드(patron `[4, 8]`, 융합 `[6, 10]`)에서는
 * 융합 열 장 중 여섯이 patron 밴드 안이라 「융합이 최강」이 거짓이었다. tier1은 배포된 124장이 통과하던
 * `[4, 8]` 그대로다: 재분류를 안 하는 것이 승률 변화의 원인을 획득 규칙과 융합 상향 둘로 묶는 유일한 길이다
 */
const valueBands: [number, number][] = [[4, 8], [8, 10], [10, 13]];
/**
 * 융합은 `tier`를 적지 않는다 — `patron_pair`가 곧 tier3이고, 두 곳에 적으면 어긋난다.
 * 화면(`ui/card.tsx`)도 이 함수를 부르므로 인자는 그 두 칸만 요구한다 — 등급 규칙이 두 벌이면
 * 「게이트는 tier2인데 화면은 tier1」이 생긴다
 */
export const cardTier = (card: Pick<Card, "patron_pair" | "tier">): number => (card.patron_pair ? valueBands.length : card.tier ?? 1);
export function isValueAllowed(card: Card): boolean {
  const tier = cardTier(card);
  const band = valueBands[tier - 1];
  if (!band) return false;
  const value = expectedValue(card);
  // 꼭대기 칸만 상한을 포함한다 — 그 위에는 밴드가 없어서다
  return value >= band[0] && (tier === valueBands.length ? value <= band[1] : value < band[1]);
}

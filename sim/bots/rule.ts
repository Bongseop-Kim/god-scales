import type { EnemyDefinition } from "../../core/combat.ts";
import type { Card } from "../../core/rules.ts";
import type { CombatState } from "../../core/state.ts";
import { demandPenalty } from "../../core/demands.ts";
import { favorBoundaries, favorInitial } from "../../core/favor.ts";
import { expectedValue, powerTurns, tokenWeights } from "../../tools/value.ts";

/**
 * v4: 토큰 값을 게이트 표(`tokenWeights`)에서 읽고, 요구 답이 조건 판정을 전제로 바뀌었다.
 * P-31의 파워 배수는 v4를 유지한다 — 기존 123장에 `power` 태그가 하나도 없어 옛 입력에서 정책이
 * 한 자리도 다르지 않다. 판을 올리면 원장의 v4 비교가 끊긴다
 */
export const botPolicyVersion = "v4";

/**
 * 확률 ε로 합법수를 무작위로 고른다. 실력을 낮춘 두 번째 열(`승률(ε)`)을 만들어 조합마다 결정이
 * 승률로 바뀌는지 보는 데만 쓴다. 회차 간 비교가 목적이라 값 자체엔 의미가 없다 — 한 번 정하고
 * 만지지 않는다. ε=0이면 rng를 한 번도 당기지 않아 기존 런과 완전히 같다.
 * ponytail: 모듈 전역 하나. 봇 객체를 만들 이유가 시뮬을 두 번 돌리는 것뿐이다
 */
export let epsilon = 0;
export function setEpsilon(value: number): void {
  epsilon = value;
}

/** ε이 터진 경우에만 무작위 합법수를 돌려준다. 아니면 undefined — 호출한 쪽이 원래 규칙을 쓴다 */
function noisyPick<T>(options: T[], rng?: () => number): T | undefined {
  if (!rng || epsilon <= 0 || !options.length || rng() >= epsilon) return undefined;
  return options[Math.floor(rng() * options.length)];
}

/**
 * 고정 정책 넷. **봇을 넷 만들지 않는다** — `cardValue`가 이미 효과별 항을 더하므로 정책은 그 항에
 * 곱하는 가중치 넷이다. 두 번째 봇을 만들면 `v4` 기준선과 비교가 끊긴다.
 * 어느 정책도 모든 조우에서 1등이 아니면 조우가 다채로운 것이다 — `--policy-matrix`가 그것을 잰다
 */
export const policies = ["single", "spread", "turtle", "token"] as const;
export type Policy = (typeof policies)[number];
type PolicyWeight = { attack: number; multi: number; block: number; token: number };
const neutral: PolicyWeight = { attack: 1, multi: 1, block: 1, token: 1 };
const policyWeights: Record<Policy, PolicyWeight> = {
  single: { attack: 1, multi: 0.3, block: 1, token: 1 },
  spread: { attack: 1, multi: 3, block: 1, token: 1 },
  turtle: { attack: 0.4, multi: 0.4, block: 3, token: 1 },
  token: { attack: 1, multi: 1, block: 1, token: 3 },
};
export let policy: Policy | undefined;
export function setPolicy(value?: Policy): void {
  policy = value;
}

function intent(combat: CombatState, definitions: ReadonlyMap<string, EnemyDefinition>): number {
  return combat.enemies.reduce((total, enemy) => {
    if (enemy.hp <= 0 || (enemy.tokens.displace ?? 0) > 0) return total;
    const pattern = definitions.get(enemy.id)?.pattern;
    return total + (pattern?.[enemy.patternIndex % pattern.length]?.damage ?? 0);
  }, 0);
}

export function cardValue(card: Card, combat: CombatState, incoming: number, favor: Record<string, number>): number {
  const living = combat.enemies.filter(({ hp }) => hp > 0).length;
  const weight = policy ? policyWeights[policy] : neutral;
  let value = 0;
  for (const effect of card.effects) {
    const amount = effect.value ?? effect.stacks ?? 0;
    if (effect.op === "damage") value += amount * (card.target === "all_enemies" ? living * weight.multi : weight.attack);
    else if (effect.op === "chain") value += amount * Math.max(0, living - 1) * weight.multi;
    else if (effect.op === "block") {
      const needed = Math.max(0, incoming - combat.player.block);
      value += (needed >= amount * 0.8 ? Math.min(amount, needed) : 0) * weight.block;
    }
    else if (effect.op === "heal") value += amount;
    else if (effect.op === "draw") value += amount * 1.5;
    else if (effect.op === "energy") value += amount * 2;
    // 토큰 값은 게이트와 같은 표에서 온다. 전부 4점으로 보면 crit(3)을 과소, shock(1)을 4배 과대평가한다
    else if (effect.op === "apply_token") value += amount * (tokenWeights[effect.token ?? ""] ?? 1) * weight.token;
    else if (effect.op === "self_damage") value -= amount;
  }
  // 파워도 게이트와 같은 배수로 본다 — 한 번짜리로 재면 봇이 절대 내지 않고 그 카드는 죽은 데이터다
  if (card.tags.includes("power")) value *= powerTurns;
  if (value > 0 && card.patron && (favor[card.patron] ?? 50) <= 15) value += 1;
  else if (value > 0 && card.patron && (favor[card.patron] ?? 50) < 30) value += 0.5;
  else if (value > 0 && card.patron && (favor[card.patron] ?? 50) < 70) value += 0.25;
  return card.tags.includes("exhaust") ? value * 0.6 : value;
}

export function choosePath(hp: number, maxHp: number): "combat" | "rest" {
  return hp < maxHp * 0.5 ? "rest" : "combat";
}

export function chooseRest(hp: number, maxHp: number): "heal" | "remove" {
  return hp < maxHp * 0.7 ? "heal" : "remove";
}

export function chooseRestCard(deck: string[], cards: ReadonlyMap<string, Card>, combat: CombatState): string {
  return [...deck].sort((left, right) => {
    const efficiency = (id: string) => {
      const card = cards.get(id);
      return card ? cardValue(card, combat, 0, {}) / Math.max(card.cost, 0.5) : Infinity;
    };
    return efficiency(left) - efficiency(right);
  })[0];
}

/**
 * 보상 시점에는 살아 있는 전투가 없다 — `cardValue`의 block 항과 all_enemies 배수가 전부 0이 되어
 * 방어·광역 카드를 구조적으로 못 고른다. 그래서 게이트가 카드를 재는 데 쓰는 기대값으로 고른다.
 */
export function chooseReward(options: string[], cards: ReadonlyMap<string, Card>, rng?: () => number): string {
  return noisyPick(options, rng) ?? [...options].sort((left, right) => expectedValue(cards.get(right)!) - expectedValue(cards.get(left)!))[0];
}

export function chooseGraceCard(cards: ReadonlyMap<string, Card>, patron: string, combat: CombatState): string | undefined {
  return [...cards.values()]
    .filter((card) => card.patron === patron)
    .sort((left, right) => cardValue(right, combat, 0, {}) / Math.max(right.cost, 0.5) - cardValue(left, combat, 0, {}) / Math.max(left.cost, 0.5))[0]?.id;
}

/** 거절에 벌금은 없다. 그러니 상대를 진노로 떨어뜨릴 때만 거절하고, 그 밖에는 받는다 */
export function chooseDemandAnswer(favor: Record<string, number>, patron: string, other: string): "accept" | "reject" {
  return (favor[other] ?? favorInitial) + demandPenalty(patron, other).amount >= favorBoundaries.anger ? "accept" : "reject";
}

export function chooseCard(
  combat: CombatState,
  cards: ReadonlyMap<string, Card>,
  definitions: ReadonlyMap<string, EnemyDefinition>,
  favor: Record<string, number> = {},
  rng?: () => number,
): string | undefined {
  const incoming = intent(combat, definitions);
  const affordable = combat.hand.filter((id) => (cards.get(id)?.cost ?? Infinity) <= combat.energy);
  // ponytail: 합법수는 손패로만 잡는다 — 무작위 턴 종료까지 넣으면 ε 열이 "아무것도 안 하는 봇"이 된다
  const noisy = noisyPick(affordable, rng);
  if (noisy) return noisy;
  const lethal = incoming >= combat.player.hp;
  const selected = affordable.sort((left, right) => {
    const a = cards.get(left)!;
    const b = cards.get(right)!;
    if (lethal) {
      const block = (card: Card) => card.effects.reduce((sum, effect) => sum + (effect.op === "block" ? effect.value ?? 0 : 0), 0);
      const defense = block(b) - block(a);
      if (defense !== 0) return defense;
    }
    return cardValue(b, combat, incoming, favor) - cardValue(a, combat, incoming, favor);
  })[0];
  if (!selected || lethal) return selected;
  return cardValue(cards.get(selected)!, combat, incoming, favor) > 0 ? selected : undefined;
}

export function chooseTarget(
  card: Card,
  combat: CombatState,
  definitions: ReadonlyMap<string, EnemyDefinition>,
  rng?: () => number,
): string | undefined {
  if (card.target !== "enemy") return undefined;
  const noisy = noisyPick(combat.enemies.filter(({ hp }) => hp > 0).map(({ id }) => id), rng);
  if (noisy) return noisy;
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

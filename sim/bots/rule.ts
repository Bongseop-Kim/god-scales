import type { EnemyDefinition } from "../../core/combat.ts";
import type { Grace, GraceHeld } from "../../core/grace.ts";
import { floorsPerRegion, type MapGrid } from "../../core/map.ts";
import type { Card } from "../../core/rules.ts";
import type { CombatState } from "../../core/state.ts";
import { demandPenalty, type DemandOffer } from "../../core/demands.ts";
import { favorBoundaries, favorInitial } from "../../core/favor.ts";
import { expectedValue, graceValue, powerTurns, tokenWeights } from "../../tools/value.ts";

/**
 * v5: `choosePath`가 「쉴까 말까」가 아니라 갈래를 고른다(P-27). 입력과 반환이 통째로 달라 옛 판과
 * 같은 결정을 낼 수가 없다 — 이때만 판을 올린다. v4는 토큰 값을 게이트 표에서 읽고 요구 답이 조건
 * 판정을 전제로 바뀐 판이었고, P-31의 파워 배수는 옛 입력에서 한 자리도 다르지 않아 v4를 유지했다
 * v6: 은총이 「카드 한 장 고르기」에서 「은혜 슬롯 3택1」이 됐다(P-28) — 고르는 것 자체가 다르다
 * v7: 요구 답이 둘에서 셋이 됐다(P-29) — `chooseDemandAnswer`의 입력과 반환이 통째로 다르다
 */
export const botPolicyVersion = "v7";

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

/**
 * 갈래를 고른다. 옵션은 `"lane:type"`이고 갈래마다 종류가 다르므로 정책은 **종류의 순위** 하나다.
 *
 * 다친 뒤에는 쉼터가 1순위고, 아니면 전투 → 예고 → 정예 → 쉼터 순이다. 정예가 전투보다 뒤인 이유는
 * 지금 정예의 보상이 전투와 같기 때문이다 — 은혜(P-28)가 붙으면 여기가 뒤집힐 자리다. 갈래가
 * `lane ±1`로 묶여 있어 원하는 종류에 못 닿는 층이 있고, 그때 정예가 실제로 선택된다
 */
/** 다치면 전부 쉼터가 1순위다 — 살아남는 것에는 취향이 없다 */
const hurtRank = ["rest", "omen", "combat", "elite"];
/**
 * 갈래 순위는 정책마다 다르다. 정책 넷은 이미 「어떻게 싸우는가」의 가중치인데 그것이 「어디로
 * 가는가」로 이어지지 않으면 같은 시드에서 넷이 같은 길을 걷는다 — 그러면 격자가 결정을 만들지
 * 못한 것이다. 새 정책을 만들지 않고 있는 넷에 경로 취향을 붙인다:
 * `spread`는 적이 많은 정예를, `turtle`은 체력을, `token`은 요구가 한 번 더 오는 예고를 먼저 본다
 */
const healthyRank: Record<Policy | "none", string[]> = {
  none: ["combat", "omen", "elite", "rest"],
  single: ["combat", "omen", "elite", "rest"],
  spread: ["elite", "combat", "omen", "rest"],
  turtle: ["rest", "combat", "omen", "elite"],
  token: ["omen", "combat", "elite", "rest"],
};

export function choosePath(options: string[], hp: number, maxHp: number, grid: MapGrid, depth: number): string {
  const rank = hp < maxHp * 0.5 ? hurtRank : healthyRank[policy ?? "none"];
  const score = (option: string) => rank.indexOf(option.split(":")[1]);
  /**
   * 종류가 같으면 **앞의 가장 가까운 쉼터로 가는 길목**을 고른다. 갈래가 `lane ±1`로 묶여 있어 지금
   * 고르는 칸이 몇 층 뒤에 닿을 수 있는 칸을 정한다 — 5층 쉼터가 보장되어 있으므로 이것이 무승부를
   * 가르는 유일한 근거다. 갈래 번호로 가르면 봇이 seed와 무관하게 한쪽 끝만 걷는다
   */
  const end = Math.min(grid.length, (Math.floor(depth / floorsPerRegion) + 1) * floorsPerRegion);
  let restLane = -1;
  for (let ahead = depth; ahead < end && restLane < 0; ahead += 1) restLane = grid[ahead].indexOf("rest");
  const detour = (option: string) => (restLane < 0 ? 0 : Math.abs(Number(option.split(":")[0]) - restLane));
  return [...options].sort((left, right) => score(left) - score(right) || detour(left) - detour(right) || (left < right ? -1 : 1))[0];
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

/**
 * 은혜는 지금 덱의 그 태그 카드 수만큼 곱해져 들어간다 — 게이트가 쓰는 환산(`graceValue`)을 그대로
 * 쓴다. 이미 찬 슬롯을 고르는 것은 **차액**만 얻는 것이라 그만큼 깎는다: 그래서 빈 슬롯이 먼저 차고,
 * tier가 올라 차액이 커지면 그때 같은 슬롯을 다시 부어 깊게 간다.
 *
 * `offer`는 그 슬롯에서 걸릴 tier의 줄로 들어온다(`graceOffer`) — 차액을 여기서 다시 풀지 않는다
 */
export function chooseGrace(offer: Grace[], held: GraceHeld, slotCards: Record<string, number>): string | undefined {
  const gain = (grace: Grace) => {
    const cards = slotCards[grace.slot] ?? 0;
    return graceValue(grace.effects, cards) - graceValue(held[grace.slot]?.effects ?? [], cards);
  };
  return [...offer].sort((left, right) => gain(right) - gain(left) || (left.id < right.id ? -1 : 1))[0]?.id;
}

/**
 * 답이 셋이다. 선불 대가가 붙은 뒤로 문제가 「받을까 말까」가 아니라 **값을 치를까**로 바뀌었다.
 *
 * - **대가가 붙은 단(시련)은 체력만 본다.** 보상이 은혜고, P-28 실측으로 은혜는 호의 어떤 값보다 크다
 *   (은혜 효과만 끄면 승률 0.563 → 0.294). 그래서 상대 신이 진노로 떨어지는 것을 **감수한다** —
 *   R-30이 「봇이 분노 문턱에서 구조적으로 거절한다」고 적은 그 규칙은 보상이 +12뿐일 때 옳았다.
 *   문턱은 `choosePath`·`chooseRest`와 같은 「반피」다: 다치면 살아남는 것에 취향이 없다
 * - **대가가 없는 단(수락)에는 옛 규칙이 그대로 남는다.** 거기 보상은 여전히 호의뿐이라 벌금 −18을
 *   무릅쓸 이유가 없다
 *
 * 통과한 가장 비싼 단을 고르고, 없으면 거절이다 — 거절에는 여전히 벌금이 없다
 */
export function chooseDemandAnswer(
  offers: DemandOffer[],
  favor: Record<string, number>,
  patron: string,
  other: string,
  hp: number,
  maxHp: number,
): string {
  const affordable = ({ cost }: DemandOffer) => cost
    ? hp - (cost.maxHp ?? 0) >= maxHp * 0.5
    : (favor[other] ?? favorInitial) + demandPenalty(patron, other).amount >= favorBoundaries.anger;
  return [...offers].reverse().find(affordable)?.action ?? "reject";
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

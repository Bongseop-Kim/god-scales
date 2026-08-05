import type { ActorState, GameState, TokenName } from "./state.ts";
import { resolveChainTargets, resolveTargets, type Target } from "./targeting.ts";

export type GodId = "zeus" | "poseidon" | "athena" | "ares" | "artemis";
export type Tag = "attack" | "defend" | "utility" | "multi" | "token" | "favor" | "exhaust" | "fused";
export type Op =
  | "damage"
  | "block"
  | "draw"
  | "energy"
  | "heal"
  | "self_damage"
  | "apply_token"
  | "favor_shift"
  | "chain";

export type Effect = {
  op: Op;
  value?: number;
  token?: TokenName;
  stacks?: number;
  god?: GodId;
  when?: string;
};

export type Card = {
  id: string;
  name: string;
  patron?: GodId;
  patronPair?: [GodId, GodId];
  cost: number;
  target: Target;
  effects: Effect[];
  tags: Tag[];
  upgraded?: boolean;
};

export function loadCards(cards: Card[]): Card[] {
  for (const card of cards) {
    if (card.target !== "enemy" && card.effects.some(({ op }) => op === "chain")) {
      throw new Error(`${card.id}: chain requires target enemy`);
    }
  }
  return cards;
}

export function addToken(actor: ActorState, token: TokenName, stacks: number): void {
  actor.tokens[token] = (actor.tokens[token] ?? 0) + stacks;
}

function consumeToken(actor: ActorState, token: TokenName): boolean {
  const stacks = actor.tokens[token] ?? 0;
  if (stacks === 0) return false;
  if (stacks === 1) delete actor.tokens[token];
  else actor.tokens[token] = stacks - 1;
  return true;
}

export function dealDamage(attacker: ActorState, target: ActorState, amount: number): number {
  if (consumeToken(target, "deflect")) {
    attacker.hp = Math.max(0, attacker.hp - amount);
    return 0;
  }

  if (consumeToken(attacker, "crit")) amount *= 2;
  // 공격자 쪽 보정 둘(광란 +2, 침수 -1), 대상 쪽 보정 둘. tools/value.ts의 tokenWeights와 같은 눈금이다
  if (consumeToken(attacker, "frenzy")) amount += 2;
  if (consumeToken(attacker, "soaked")) amount = Math.max(0, amount - 1);
  // 감전은 스택마다 +1로 이번 턴의 모든 피해를 키운다(턴 끝에 사라진다). 한 방에 소모되면 후속타가 없는
  // 대상에서 그냥 버려져 기본 피해보다 못하다 — 제우스의 chain 여러 대상 타격과 맞물리는 자리다
  amount += target.tokens.shock ?? 0;
  // 표식만 소모되지 않는다 — 전투가 끝날 때까지 그 적이 1.5배로 맞는다. 그래서 스택이 아니라 배수다.
  // 체력은 정수여야 한다 — 5 × 1.5를 그대로 쓰면 7.5가 hp에 들어가고 화면에 소수가 뜬다
  if ((target.tokens.mark ?? 0) > 0) amount = Math.round(amount * 1.5);
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  amount -= blocked;
  const bulwark = Math.min(target.tokens.bulwark ?? 0, amount);
  if (bulwark > 0) {
    target.tokens.bulwark = (target.tokens.bulwark ?? 0) - bulwark;
    if (target.tokens.bulwark === 0) delete target.tokens.bulwark;
    amount -= bulwark;
  }
  target.hp = Math.max(0, target.hp - amount);
  return amount;
}

export function tickBleed(actor: ActorState): number {
  const damage = actor.tokens.bleed ?? 0;
  if (damage > 0) {
    actor.hp = Math.max(0, actor.hp - damage);
    consumeToken(actor, "bleed");
  }
  return damage;
}

export function takeEnemyTurn(enemy: ActorState & { patternIndex: number }): boolean {
  if (consumeToken(enemy, "displace")) return false;
  enemy.patternIndex += 1;
  return true;
}

export function clearEncounterTokens(state: GameState): void {
  state.combat.player.tokens = {};
  for (const enemy of state.combat.enemies) enemy.tokens = {};
}

type ConditionContext = {
  state: GameState;
  card: Card;
  target: ActorState;
  deckCards?: Card[];
};

function compare(left: number, operator: string, right: number): boolean {
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  if (operator === ">") return left > right;
  throw new Error(`Unsupported comparator: ${operator}`);
}

export function evaluateCondition(expression: string, context: ConditionContext): boolean {
  let match = expression.match(/^favor\((patron|[a-z_]+)\) (>=|<) (\d+)$/);
  if (match) {
    const gods = match[1] === "patron"
      ? context.card.patronPair ?? (context.card.patron ? [context.card.patron] : [])
      : [match[1]];
    const favor = Math.min(...gods.map((god) => context.state.favor[god] ?? 0));
    return compare(favor, match[2], Number(match[3]));
  }

  match = expression.match(/^has_token\(target, ([a-z_]+)\) >= (\d+)$/);
  if (match) return (context.target.tokens[match[1] as TokenName] ?? 0) >= Number(match[2]);
  match = expression.match(/^turn > (\d+)$/);
  if (match) return context.state.combat.turn > Number(match[1]);
  match = expression.match(/^hp_pct\(self\) < (\d+)$/);
  if (match) return (context.state.combat.player.hp / context.state.combat.player.maxHp) * 100 < Number(match[1]);
  match = expression.match(/^deck_count\(([a-z_]+)\) >= (\d+)$/);
  if (match) return (context.deckCards ?? []).filter(({ tags }) => tags.includes(match![1] as Tag)).length >= Number(match[2]);
  match = expression.match(/^enemy_count\(\) >= (\d+)$/);
  if (match) return context.state.combat.enemies.filter(({ hp }) => hp > 0).length >= Number(match[1]);
  throw new Error(`Invalid condition: ${expression}`);
}

/** 카드의 target이 무엇이든 플레이어에게 붙는 토큰. 나머지는 target으로 간다 — 게이트도 이 목록을 읽는다 */
export const selfTokens = new Set<TokenName>(["bulwark", "deflect", "crit", "frenzy"]);

export function executeCard(state: GameState, card: Card, enemyId?: string, deckCards?: Card[]): void {
  loadCards([card]);
  const targets = resolveTargets(state.combat, card.target, enemyId);
  const chainTargets = card.target === "enemy" ? resolveChainTargets(state.combat, targets[0].id) : [];

  for (const effect of card.effects) {
    if (effect.when && !evaluateCondition(effect.when, { state, card, target: targets[0], deckCards })) continue;
    const value = effect.value ?? 0;
    if (effect.op === "damage") for (const target of targets) dealDamage(state.combat.player, target, value);
    else if (effect.op === "block") state.combat.player.block += value;
    else if (effect.op === "draw") for (let count = 0; count < value && state.combat.drawPile.length > 0; count += 1) state.combat.hand.push(state.combat.drawPile.shift()!);
    else if (effect.op === "energy") state.combat.energy += value;
    else if (effect.op === "heal") state.combat.player.hp = Math.min(state.combat.player.maxHp, state.combat.player.hp + value);
    else if (effect.op === "self_damage") state.combat.player.hp = Math.max(0, state.combat.player.hp - value);
    else if (effect.op === "apply_token") {
      if (!effect.token) throw new Error(`${card.id}: apply_token requires token`);
      const tokenTargets = selfTokens.has(effect.token) ? [state.combat.player] : targets;
      for (const target of tokenTargets) addToken(target, effect.token, effect.stacks ?? 1);
    } else if (effect.op === "favor_shift") {
      const god = effect.god ?? card.patron;
      if (!god) throw new Error(`${card.id}: favor_shift requires god`);
      state.favor[god] = (state.favor[god] ?? 0) + value;
    } else if (effect.op === "chain") {
      for (const target of chainTargets) dealDamage(state.combat.player, target, value);
    }
  }
}

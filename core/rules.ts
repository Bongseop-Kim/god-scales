import type { GraceSlot } from "./grace.ts";
import { tokenNames, type ActorState, type CombatState, type GameState, type TokenName, type Trigger } from "./state.ts";
import { livingInReach, reachSlots, resolveChainTargets, resolveTargets, type Target } from "./targeting.ts";

export type GodId = "zeus" | "poseidon" | "athena" | "ares" | "artemis";
export type Tag = "attack" | "defend" | "utility" | "multi" | "token" | "favor" | "exhaust" | "fused" | "power";
export type Op =
  | "damage"
  | "block"
  | "draw"
  | "energy"
  | "heal"
  | "self_damage"
  | "apply_token"
  | "favor_shift"
  | "chain"
  /** 개입만 쓴다 — 카드가 적으면 `executeCard`가 조용히 삼키므로 게이트가 카드 어휘에서 뺀다 */
  | "join";

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
  /** `power` 태그가 붙은 카드만 갖는다 — 즉시 실행하지 않고 이 훅에 등록한다 */
  trigger?: Trigger;
  /** 닿는 칸을 오름차순으로 적은 숫자열(`"012"`). 없으면 네 칸 전부다 */
  reach?: string;
  /**
   * 값의 계단. 없으면 1이고 융합은 적지 않는다 — `patronPair`가 곧 3이다(`tools/value.ts`의 `cardTier`).
   * 보상 3택1에서 어느 자리가 몇 티어인지는 깊이가 정한다(`sim/engine.ts`의 `tier2Slots`)
   */
  tier?: 1 | 2;
};

export function loadCards(cards: Card[]): Card[] {
  for (const card of cards) {
    if (card.effects.some(({ op }) => op === "chain")) {
      if (card.target !== "enemy") throw new Error(`${card.id}: chain requires target enemy`);
      // 한 칸짜리 사거리에서는 연쇄가 닿을 곳이 없다 — 죽은 효과다
      if (reachSlots(card.reach).length < 2) throw new Error(`${card.id}: chain requires two reachable slots`);
    }
  }
  return cards;
}

/**
 * 상쇄 쌍은 **하나만** 둔다 — 광란(+2)과 침수(−1)는 `dealDamage`에서 이미 정확히 반대 부호다.
 * 한쪽을 걸면 반대쪽이 그만큼 사라진다. 사제가 적의 광란을 벗겨내는 적이 되는 자리다
 */
const tokenOpposites: Partial<Record<TokenName, TokenName>> = { frenzy: "soaked", soaked: "frenzy" };

export function addToken(actor: ActorState, token: TokenName, stacks: number): void {
  // ward가 해로운 토큰을 스택 하나씩 먹는다 — 토큰 일변도에 대한 답이고, 다 쓰면 사라진다
  if (actor.passives?.ward && harmfulTokens.has(token)) {
    const warded = Math.min(actor.passives.ward, stacks);
    actor.passives.ward -= warded;
    stacks -= warded;
  }
  const opposite = tokenOpposites[token];
  if (opposite && actor.tokens[opposite]) {
    const cancelled = Math.min(actor.tokens[opposite], stacks);
    actor.tokens[opposite] -= cancelled;
    if (!actor.tokens[opposite]) delete actor.tokens[opposite];
    stacks -= cancelled;
  }
  if (stacks <= 0) return;
  actor.tokens[token] = (actor.tokens[token] ?? 0) + stacks;
}

function consumeToken(actor: ActorState, token: TokenName): boolean {
  const stacks = actor.tokens[token] ?? 0;
  if (stacks === 0) return false;
  if (stacks === 1) delete actor.tokens[token];
  else actor.tokens[token] = stacks - 1;
  return true;
}

export function dealDamage(attacker: ActorState, target: ActorState, amount: number, reflected = false): number {
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
  // shell은 체력에 닿기 직전에 자른다 — 방어·보루를 지난 뒤의 「잃은 체력」이 한 턴에 X를 못 넘는다.
  // 「한 턴」은 플레이어 턴 + 적 턴 한 바퀴이고 `endTurn` 맨 끝에서 리셋된다
  if (target.passives?.shell !== undefined) amount = Math.min(amount, Math.max(0, target.passives.shell - (target.lostThisTurn ?? 0)));
  target.lostThisTurn = (target.lostThisTurn ?? 0) + amount;
  target.hp = Math.max(0, target.hp - amount);
  // 반사는 「맞은 것」이 아니다 — curl·angry는 실제로 체력이 깎인 뒤에만 센다. 그렇게 두지 않으면
  // 아테나 반사가 angry 적 앞에서 공짜 답이 된다
  if (amount > 0) {
    if (!target.hit) {
      target.hit = true;
      if (target.passives?.curl) target.block += target.passives.curl;
    }
    if (target.passives?.angry) addToken(target, "frenzy", target.passives.angry);
  }
  /**
   * 가시는 상시 반격이다 — 방어로 다 막아도 터진다. `amount > 0` 뒤에 두면 방어를 쌓는 아테나가
   * 자기 가시를 지우게 된다. **주 피해가 끝난 뒤에** 터뜨리는 이유는 먼저 터지면 반격이 깨운 `angry`
   * 광란을 바로 그 공격이 소모해 「가시가 자기를 때린 공격을 세게 만드는」 순서가 되기 때문이다.
   * `deflect`로 통째로 무효화된 공격은 위에서 조기 반환되므로 여기까지 오지 않는다.
   * `reflected`가 깊이를 2로 못 박는다 — 「적은 가시를 못 갖는다」는 데이터 규칙이 아니다. 적 패턴은
   * `target: self`로 아무 토큰이나 붙일 수 있고(`bulwark`가 그렇게 산다) 양쪽이 가시를 들면 무한 반사다
   */
  const thorns = target.tokens.thorns ?? 0;
  if (thorns > 0 && !reflected) dealDamage(target, attacker, thorns, true);
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

/**
 * 밀려난 적을 뒤로 한 칸 보내고, 이번 턴을 쉬는 적을 돌려준다. 토큰 하나가 두 일을 하지만
 * 그 둘은 같은 그림이다 — 밀려난 적은 자세를 잃고 자리를 내준다.
 *
 * **역순(칸 3 → 0)으로 돈다.** 정순이면 앞칸이 비켜 준 자리로 올라온 적을 같은 턴에 다시 만나
 * 한 카드가 두 칸을 움직인다. 맨 뒤는 불발이다 — 토큰은 소모되고 자리는 그대로다.
 *
 * **뒤가 비어 있어도 이동이 아니라 맞바꿈이다.** 앞에 구멍이 나는 것은 어느 쪽이든 같다 —
 * 밀어내기는 그래서 실제로 「진노한 신을 앞칸에 불러오는 카드」이기도 하다(`admitPending`이 가장 앞
 * 빈 칸을 쓴다). 맞바꿈이 지키는 것은 **뒤칸에 있던 것 자체**다: 이동은 그 자리의 시체를 덮어 쓰고,
 * `queueEnemy`는 판에 선 id로 중복을 막으므로 그러면 방금 죽인 신이 같은 조우에 다시 큐에 든다
 */
export function shoveDisplaced(combat: CombatState): Set<ActorState> {
  // 배우 **그 자체**로 센다 — id로 세면 같은 적 둘이 선 편성에서 한쪽의 밀림이 둘의 턴을 지운다
  const shoved = new Set<ActorState>();
  for (let slot = combat.enemies.length - 1; slot >= 0; slot -= 1) {
    const enemy = combat.enemies[slot];
    if (enemy.hp <= 0 || !consumeToken(enemy, "displace")) continue;
    shoved.add(enemy);
    // 자리를 통째로 맞바꾸므로 상태·토큰·패턴 진행이 다 따라간다 — `definitions.get`은 id로 읽는다
    if (slot + 1 < combat.enemies.length) [combat.enemies[slot], combat.enemies[slot + 1]] = [combat.enemies[slot + 1], combat.enemies[slot]];
  }
  return shoved;
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
  /**
   * 칸은 배열 인덱스다(`core/targeting.ts`) — 사거리와 다른 것을 잰다: 사거리는 닿는지를 정하고
   * 이 조건은 닿은 뒤 값을 바꾼다. 대상이 적이 아니면 -1이라 `>=`는 거짓이다
   */
  match = expression.match(/^slot\(target\) (>=|<) (\d+)$/);
  if (match) return compare(context.state.combat.enemies.findIndex((enemy) => enemy === context.target), match[1], Number(match[2]));
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
export const selfTokens = new Set<TokenName>(["bulwark", "deflect", "crit", "frenzy", "thorns"]);
/** 이로운 넷의 여집합이다 — 세 번째 목록을 만들지 않는다. `ward`와 P-26의 HUD 색이 같은 집합을 읽는다 */
export const harmfulTokens = new Set(tokenNames.filter((token) => !selfTokens.has(token)));
/**
 * 소모 경로가 `takeEnemyTurn`뿐인 토큰. 플레이어에게 붙으면 영원히 안 지워지고 아무 일도 하지 않는다 —
 * 포세이돈 진노가 그 자리였다. 게이트가 이 목록으로 「죽은 개입」을 반려한다
 */
export const enemyOnlyTokens = new Set<TokenName>(["displace"]);

/**
 * `guard`가 스택마다 한 번, 아군에게 갈 피해를 대신 받는다 — 「센 카드로 한 놈만」의 직접 대응이다.
 * **재지정은 1회**다: A가 B를 지키고 B가 A를 지키면 순환한다. 광역·연쇄는 어차피 지킴이도 같이
 * 맞으므로 재지정하지 않는다 — 그러면 한 카드가 지킴이를 두 번 때린다.
 *
 * **재지정은 같은 사거리 안에서만 일어난다.** `012` 카드로 뒷칸을 노리면 앞칸 지킴이가 대신 받고,
 * `3`·`23` 카드는 지킴이를 지나간다 — 좁은 사거리가 값을 갖는 유일한 이유고, 이것이 없으면
 * 아홉 모양은 하향 아홉 종류일 뿐이다
 */
function guardFor(combat: CombatState, target: ActorState, reach?: string): ActorState {
  const guard = livingInReach(combat, reach).find((enemy) => enemy.id !== target.id && (enemy.passives?.guard ?? 0) > 0);
  if (!guard?.passives?.guard) return target;
  guard.passives.guard -= 1;
  return guard;
}

/**
 * 등록된 파워를 훅 하나만큼 발동한다. **새 실행 경로를 만들지 않는다** — 카드가 낼 때 타는 그
 * `executeCard`를 그대로 탄다. 대상 하나를 요구하는 파워는 지정이 없으면 살아 있는 첫 적에게 간다
 */
export function firePowers(state: GameState, trigger: Trigger, enemyId?: string): void {
  // 발동 중에 등록이 늘어날 수 있으므로 사본을 돈다
  for (const power of [...state.combat.powers]) {
    if (power.trigger !== trigger) continue;
    /**
     * 대상은 **파워마다 다시** 고른다 — 앞 파워가 그 적을 죽였을 수 있고, 지정된 적이 이미 시체일
     * 수도 있다. 사거리 안에 살아 있는 적이 없으면 적을 요구하는 파워는 쉰다. 파워는 던지지 않는다
     */
    const reachable = livingInReach(state.combat, power.card.reach);
    const target = reachable.find(({ id }) => id === enemyId) ?? reachable[0];
    if (power.card.target === "enemy" && !target) continue;
    executeCard(state, power.card, target?.id);
  }
}

/**
 * 이 카드가 실제로 내는 효과 — 카드의 것 + 그 카드의 태그에 걸린 은혜의 것. 태그가 곧 슬롯이라
 * 공격 카드 한 장이 아니라 **공격 행동 전체**가 바뀐다. 태그가 둘이면 은혜도 둘 붙는다.
 *
 * 세는 쪽(`sim/engine.ts`의 토큰·방어 집계)도 같은 목록을 읽는다 — 화면에 붙은 토큰을 요구가
 * 세지 않으면 그게 두 번째 진실이다
 */
export function cardEffects(state: GameState, card: Card): Effect[] {
  const graced = card.tags.flatMap((tag) => state.graceSlots[tag as GraceSlot]?.effects ?? []);
  return graced.length ? [...card.effects, ...graced] : card.effects;
}

export function executeCard(state: GameState, card: Card, enemyId?: string, deckCards?: Card[]): void {
  loadCards([card]);
  const targets = resolveTargets(state.combat, card.target, enemyId, card.reach);
  const chainTargets = card.target === "enemy" ? resolveChainTargets(state.combat, targets[0].id, card.reach) : [];
  /**
   * 조건의 대상. 사거리 밖만 남은 `all_enemies` 카드는 대상이 없어도 낼 수 있으므로(§2) 여기가 빈다 —
   * 그때 조건 붙은 효과는 붙지 않는다. 방어·회복처럼 대상을 안 보는 효과는 그대로 돈다
   */
  const conditionTarget = targets[0];
  /**
   * 「무방비 피해」는 여기가 자리다 — P-25가 `guard`를 `dealDamage` **호출부**에 둔 것과 같은 줄이고,
   * `dealDamage`는 `GameState`를 모른다. 파워가 낸 피해로는 다시 터지지 않는다(그래야 순환이 없다)
   */
  const strike = (target: ActorState, value: number) => {
    const dealt = dealDamage(state.combat.player, target, value);
    // 마무리 일격은 세지 않는다 — 시체에 토큰을 붙일 자리가 없다
    if (dealt > 0 && target.hp > 0 && !card.tags.includes("power")) firePowers(state, "on_unblocked", target.id);
  };

  for (const effect of cardEffects(state, card)) {
    if (effect.when && !(conditionTarget && evaluateCondition(effect.when, { state, card, target: conditionTarget, deckCards }))) continue;
    const value = effect.value ?? 0;
    if (effect.op === "damage") for (const target of targets) strike(card.target === "enemy" ? guardFor(state.combat, target, card.reach) : target, value);
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
      // 대상은 카드 시작에 골랐다 — 앞 효과나 그것이 깨운 파워가 죽였을 수 있다. 시체를 때리면
      // 가시가 되돌아오고 angry가 광란을 쌓는다(「마무리 일격은 세지 않는다」와 같은 자리다)
      for (const target of chainTargets) if (target.hp > 0) strike(target, value);
    }
  }
}

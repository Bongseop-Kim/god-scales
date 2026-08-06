import { bossLane } from "./map.ts";
import { createRng } from "./rng.ts";
import { addToken, dealDamage, executeCard, firePowers, takeEnemyTurn, tickBleed, type Card } from "./rules.ts";
import type { ActorState, CombatState, EnemyState, GameState, Passives, TokenName } from "./state.ts";
import { canReachTarget, livingInReach } from "./targeting.ts";

export const MAX_HP = 100;
export const ENERGY_PER_TURN = 3;
export const DRAW_PER_TURN = 5;
export const HAND_LIMIT = 10;
export const TURN_LIMIT = 50;
/**
 * 칸 수. **0이 앞**(플레이어와 가까운 쪽)이고 3이 뒤다 — `laneCount`가 3을 박아 둔 것과 같은 자리다.
 * 판은 언제나 이 길이고, 조우가 적게 데려오면 그 칸이 처음부터 비어 있다
 */
export const MAX_SLOTS = 4;

/** 적 행동 하나. `target`이 없으면 플레이어를 친다 — StS의 「아군 지원」이 `ally` 자리다 */
export type EnemyAction = {
  damage?: number; block?: number; token?: TokenName; stacks?: number;
  heal?: number;
  target?: "player" | "self" | "ally";
};
export type EnemyDefinition = { id: string; hp: number; pattern: EnemyAction[]; bulwark?: number; passives?: Passives };
/** 편성 한 줄. 순서가 곧 칸이고 `null`이 빈 칸이다 — `[a, null, null, b]`가 칸 0·3에 선다 */
export type Lineup = (EnemyDefinition | null)[];

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

// 패시브는 전투마다 복사한다 — `ward`·`guard`는 소모되므로 정의를 그대로 들면 다음 전투가 빈손이다
const enemyState = ({ id, hp, bulwark, passives }: EnemyDefinition): EnemyState => ({
  id,
  hp,
  maxHp: hp,
  block: 0,
  tokens: bulwark ? { bulwark } : {},
  patternIndex: 0,
  ...(passives ? { passives: { ...passives } } : {}),
});
/**
 * 빈 칸. **시체와 같은 꼴**이라 `hp > 0` 필터가 전부 그대로 돈다 — `defeated`를 미리 찍어야
 * `updateOutcome`이 이것을 방금 죽은 적으로 세지 않는다(`rally`가 헛돈다)
 */
const emptySlot = (slot: number): EnemyState => ({ id: `empty_${slot}`, hp: 0, maxHp: 0, block: 0, tokens: {}, patternIndex: 0, defeated: true });

export function createCombat(seed: number, deck: string[], lineup: Lineup): CombatState {
  if (lineup.length > MAX_SLOTS) throw new Error(`Encounter needs ${lineup.length} slots, the board has ${MAX_SLOTS}`);
  return {
    turn: 0,
    energy: 0,
    outcome: "ongoing",
    timeout: false,
    player: { id: "player", hp: MAX_HP, maxHp: MAX_HP, block: 0, tokens: {} },
    drawPile: shuffle(deck, createRng(seed)),
    hand: [],
    discardPile: [],
    powers: [],
    pending: [],
    enemies: Array.from({ length: MAX_SLOTS }, (_, slot) => {
      const definition = lineup[slot];
      return definition ? enemyState(definition) : emptySlot(slot);
    }),
  };
}

/** 이미 판에 서 있거나(시체도 서 있는 것이다) 큐에 있는 적은 다시 넣지 않는다 */
export function queueEnemy(combat: CombatState, id: string): void {
  if (combat.pending.includes(id) || combat.enemies.some((enemy) => enemy.id === id)) return;
  combat.pending.push(id);
}

/**
 * 죽은 적을 거둔다. **자리를 다시 쓰기 전에** 찍어야 한다 — 시체가 밀려난 뒤에는 셀 것이 없고
 * `rally`가 그 죽음을 못 본다. 그래서 `updateOutcome`과 `admitPending` 둘 다 여기를 지난다
 */
function markDefeated(combat: CombatState): void {
  for (const dead of combat.enemies) {
    if (dead.hp > 0 || dead.defeated) continue;
    dead.defeated = true;
    // rally는 「아무나 먼저 죽이기」를 처벌한다 — 처치 순서가 결정이 되는 자리다
    for (const ally of combat.enemies) if (ally.hp > 0 && ally.passives?.rally) addToken(ally, "frenzy", ally.passives.rally);
  }
}

/**
 * 큐에 선 적을 빈 칸에 세운다. 빈 칸이 없으면 아무 일도 없다 — 큐는 그대로 기다린다.
 * 빈 칸이 여럿이면 가장 앞(인덱스 최소)이고, 시체는 그 자리에서 밀려난다 — 밀어내기 전에 거두므로
 * `rally`가 그 죽음을 한 번 본다(빈 칸은 `defeated`가 이미 찍혀 있어 두 번 세지 않는다).
 *
 * **카드 실행 중에는 부르지 않는다.** `executeCard`가 연쇄 대상을 카드 시작에 잡아 두므로 실행 중
 * 배열이 바뀌면 방금 들어온 적이 진행 중인 연쇄에 맞는다
 */
export function admitPending(combat: CombatState, definitions: ReadonlyMap<string, EnemyDefinition>): void {
  markDefeated(combat);
  while (combat.pending.length > 0) {
    const slot = combat.enemies.findIndex(({ hp }) => hp <= 0);
    if (slot < 0) return;
    const id = combat.pending[0];
    const definition = definitions.get(id);
    if (!definition) throw new Error(`Missing pending enemy definition: ${id}`);
    combat.pending.shift();
    combat.enemies[slot] = enemyState(definition);
  }
}

export function drawCards(combat: CombatState, count: number, random: () => number): void {
  for (let drawn = 0; drawn < count && combat.hand.length < HAND_LIMIT; drawn += 1) {
    if (combat.drawPile.length === 0 && combat.discardPile.length > 0) {
      combat.drawPile = shuffle(combat.discardPile, random);
      combat.discardPile = [];
    }
    const card = combat.drawPile.shift();
    if (!card) return;
    combat.hand.push(card);
  }
}

export function startTurn(state: GameState, random: () => number): void {
  const combat = state.combat;
  combat.turn += 1;
  if (combat.turn > TURN_LIMIT) {
    combat.outcome = "timeout";
    combat.timeout = true;
    return;
  }
  combat.player.block = 0;
  combat.energy = ENERGY_PER_TURN;
  drawCards(combat, DRAW_PER_TURN, random);
  // 뽑은 뒤에 터뜨린다 — 파워가 준 토큰이 이번 턴 손패와 같은 화면에 서야 한다
  firePowers(state, "turn_start");
  updateOutcome(combat);
}

export function playCard(
  state: GameState,
  cards: ReadonlyMap<string, Card>,
  cardId: string,
  enemyId?: string,
): void {
  const handIndex = state.combat.hand.indexOf(cardId);
  const card = cards.get(cardId);
  if (handIndex < 0 || !card) throw new Error(`Card is not in hand: ${cardId}`);
  if (card.cost > state.combat.energy) throw new Error(`Not enough energy for: ${cardId}`);
  state.combat.energy -= card.cost;
  state.combat.hand.splice(handIndex, 1);
  // 파워는 지금 일하지 않는다 — 트리거에 등록하고 전투 내내 남는다
  if (card.tags.includes("power")) {
    if (!card.trigger) throw new Error(`${card.id}: power requires a trigger`);
    state.combat.powers.push({ trigger: card.trigger, card });
  } else executeCard(state, card, enemyId, [...cards.values()]);
  // 파워를 내는 것도 카드를 내는 것이다(StS와 같다) — 등록한 그 턴부터 on_play가 센다
  firePowers(state, "on_play", enemyId);
  // spite는 비공격 카드를 처벌한다 — 방어만 쌓는 판을 시간이 흐를수록 비싸게 만든다
  if (!card.tags.includes("attack")) {
    for (const enemy of state.combat.enemies) if (enemy.hp > 0 && enemy.passives?.spite) addToken(enemy, "frenzy", enemy.passives.spite);
  }
  // 등록한 파워는 덱으로 돌아가지 않는다 — 버림더미에 두면 다시 뽑혀 한 장이 스스로 두 번 등록한다.
  // 스택은 덱에 두 장을 넣은 대가여야 한다(`test/combat.test.ts`의 「상한은 없다」)
  if (!card.tags.includes("exhaust") && !card.tags.includes("power")) state.combat.discardPile.push(cardId);
  updateOutcome(state.combat);
}

/**
 * 대상이 없으면 피해·토큰은 플레이어, 방어·회복은 자신이다 — 적이 플레이어에게 방어를 줄 일은 없고,
 * 그래서 기존 `block` 패턴이 그대로 돈다. `ally`는 자신을 뺀 살아 있는 하나(없으면 불발)다
 */
function actionTargets(combat: CombatState, enemy: EnemyState, target: EnemyAction["target"]): ActorState[] {
  if (target === "player") return [combat.player];
  if (target === "self") return [enemy];
  return combat.enemies.filter(({ hp, id }) => hp > 0 && id !== enemy.id).slice(0, 1);
}

export function endTurn(state: GameState, definitions: ReadonlyMap<string, EnemyDefinition>): void {
  const combat = state.combat;
  combat.discardPile.push(...combat.hand);
  combat.hand = [];
  // 적이 행동하기 **전에** 터뜨린다 — 턴 끝 방벽이 이번 턴의 공격을 못 받으면 아무 값도 없다
  firePowers(state, "turn_end");

  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    const definition = definitions.get(enemy.id);
    if (!definition || definition.pattern.length === 0) throw new Error(`Missing enemy pattern: ${enemy.id}`);
    const patternIndex = enemy.patternIndex;
    if (!takeEnemyTurn(enemy)) continue;
    const action = definition.pattern[patternIndex % definition.pattern.length];
    // ramp는 장기전을 처벌한다 — 매 턴 광란이 쌓이므로 오래 끌수록 같은 패턴이 더 아프다
    if (enemy.passives?.ramp) addToken(enemy, "frenzy", enemy.passives.ramp);
    for (const target of actionTargets(combat, enemy, action.target ?? "player")) {
      if (action.damage) dealDamage(enemy, target, action.damage);
      if (action.token) addToken(target, action.token, action.stacks ?? 1);
    }
    for (const target of actionTargets(combat, enemy, action.target ?? "self")) {
      if (action.block) target.block += action.block;
      if (action.heal) target.hp = Math.min(target.maxHp, target.hp + action.heal);
    }
    if (combat.player.hp <= 0) break;
  }

  tickBleed(combat.player);
  for (const enemy of combat.enemies) tickBleed(enemy);
  // 감전은 한 턴짜리다. 적의 공격까지 끝난 뒤에 지운다 — 플레이어에게 걸린 감전도 그 턴에 값을 해야 한다.
  // shell의 「한 턴」도 여기서 끝난다: 플레이어 턴 + 적 턴 한 바퀴다
  for (const actor of [combat.player, ...combat.enemies]) {
    delete actor.tokens.shock;
    actor.lostThisTurn = 0;
  }
  // 청소가 다 끝난 뒤에 입장시킨다 — `updateOutcome` **앞**이어야 기다리던 신이 조우를 이어받는다
  admitPending(combat, definitions);
  updateOutcome(combat);
}

export function updateOutcome(combat: CombatState): void {
  markDefeated(combat);
  if (combat.player.hp <= 0) combat.outcome = "defeat";
  else if (combat.enemies.every(({ hp }) => hp <= 0)) combat.outcome = "victory";
}

export function effectiveHp(enemy: EnemyState): number {
  return enemy.hp + (enemy.tokens.bulwark ?? 0);
}

export function runCombat(
  seed: number,
  deck: string[],
  cardList: Card[],
  enemyList: EnemyDefinition[],
): { state: GameState; snapshots: string[] } {
  const cards = new Map(cardList.map((card) => [card.id, card]));
  const definitions = new Map(enemyList.map((enemy) => [enemy.id, enemy]));
  const random = createRng(seed);
  const state: GameState = {
    seed,
    combat: createCombat(seed, deck, enemyList),
    favor: {},
    grace: {},
    graceSlots: {},
    // 전투 하나만 돌리므로 격자는 비어 있다 — 여기서 지도를 읽는 코드는 없다
    map: { depth: 0, lane: bossLane, grid: [], completed: [] },
  };
  const snapshots: string[] = [];

  const nextPlayable = () => state.combat.hand.find((id) => {
    const card = cards.get(id);
    return card !== undefined && card.cost <= state.combat.energy && canReachTarget(state.combat, card);
  });

  while (state.combat.outcome === "ongoing") {
    startTurn(state, random);
    if (state.combat.outcome !== "ongoing") break;
    let playable = nextPlayable();
    while (playable && state.combat.outcome === "ongoing") {
      const target = livingInReach(state.combat, cards.get(playable)!.reach)[0]?.id;
      playCard(state, cards, playable, target);
      playable = nextPlayable();
    }
    if (state.combat.outcome === "ongoing") endTurn(state, definitions);
    snapshots.push(JSON.stringify(state.combat));
  }
  return { state, snapshots };
}

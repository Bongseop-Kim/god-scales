import { createRng } from "./rng.ts";
import { dealDamage, executeCard, takeEnemyTurn, tickBleed, type Card } from "./rules.ts";
import type { CombatState, EnemyState, GameState, TokenName } from "./state.ts";

export const MAX_HP = 100;
export const ENERGY_PER_TURN = 3;
export const DRAW_PER_TURN = 5;
export const HAND_LIMIT = 10;
export const TURN_LIMIT = 50;

export type EnemyAction = { damage?: number; block?: number; token?: TokenName; stacks?: number };
export type EnemyDefinition = { id: string; hp: number; pattern: EnemyAction[]; bulwark?: number };

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createCombat(seed: number, deck: string[], definitions: EnemyDefinition[]): CombatState {
  return {
    turn: 0,
    energy: 0,
    outcome: "ongoing",
    timeout: false,
    player: { id: "player", hp: MAX_HP, maxHp: MAX_HP, block: 0, tokens: {} },
    drawPile: shuffle(deck, createRng(seed)),
    hand: [],
    discardPile: [],
    enemies: definitions.map(({ id, hp, bulwark }) => ({
      id,
      hp,
      maxHp: hp,
      block: 0,
      tokens: bulwark ? { bulwark } : {},
      patternIndex: 0,
    })),
  };
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

export function startTurn(combat: CombatState, random: () => number): void {
  combat.turn += 1;
  if (combat.turn > TURN_LIMIT) {
    combat.outcome = "timeout";
    combat.timeout = true;
    return;
  }
  combat.player.block = 0;
  combat.energy = ENERGY_PER_TURN;
  drawCards(combat, DRAW_PER_TURN, random);
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
  executeCard(state, card, enemyId, [...cards.values()]);
  if (!card.tags.includes("exhaust")) state.combat.discardPile.push(cardId);
  updateOutcome(state.combat);
}

export function endTurn(combat: CombatState, definitions: ReadonlyMap<string, EnemyDefinition>): void {
  combat.discardPile.push(...combat.hand);
  combat.hand = [];

  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    const definition = definitions.get(enemy.id);
    if (!definition || definition.pattern.length === 0) throw new Error(`Missing enemy pattern: ${enemy.id}`);
    const patternIndex = enemy.patternIndex;
    if (!takeEnemyTurn(enemy)) continue;
    const action = definition.pattern[patternIndex % definition.pattern.length];
    if (action.damage) dealDamage(enemy, combat.player, action.damage);
    if (action.block) enemy.block += action.block;
    if (action.token) combat.player.tokens[action.token] = (combat.player.tokens[action.token] ?? 0) + (action.stacks ?? 1);
    if (combat.player.hp <= 0) break;
  }

  tickBleed(combat.player);
  for (const enemy of combat.enemies) tickBleed(enemy);
  // 감전은 한 턴짜리다. 적의 공격까지 끝난 뒤에 지운다 — 플레이어에게 걸린 감전도 그 턴에 값을 해야 한다
  for (const actor of [combat.player, ...combat.enemies]) delete actor.tokens.shock;
  updateOutcome(combat);
}

export function updateOutcome(combat: CombatState): void {
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
    map: { node: 0, completed: [] },
  };
  const snapshots: string[] = [];

  while (state.combat.outcome === "ongoing") {
    startTurn(state.combat, random);
    if (state.combat.outcome !== "ongoing") break;
    let playable = state.combat.hand.find((id) => (cards.get(id)?.cost ?? Infinity) <= state.combat.energy);
    while (playable && state.combat.outcome === "ongoing") {
      const target = state.combat.enemies.find(({ hp }) => hp > 0)?.id;
      playCard(state, cards, playable, target);
      playable = state.combat.hand.find((id) => (cards.get(id)?.cost ?? Infinity) <= state.combat.energy);
    }
    if (state.combat.outcome === "ongoing") endTurn(state.combat, definitions);
    snapshots.push(JSON.stringify(state.combat));
  }
  return { state, snapshots };
}

import { createCombat, endTurn, playCard, startTurn, type EnemyDefinition } from "../core/combat.ts";
import { createRng } from "../core/rng.ts";
import cardDataJson from "../data/cards.json" with { type: "json" };
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import { awardGrace, finishCombatFavor, recordCardFavor, type FavorUses } from "../core/favor.ts";
import { demandPenalty, resolveDemand } from "../core/demands.ts";
import { advanceMap, enemyDamageScale, mapNode, takeRest } from "../core/map.ts";
import { reduceCardCost, upgradeCard } from "../core/upgrade.ts";
import { canFuse } from "../core/fusion.ts";
import type { Card, GodId } from "../core/rules.ts";
import type { GameState } from "../core/state.ts";
import { chooseCard, choosePath, chooseRest, chooseRestCard, chooseTarget } from "./bots/rule.ts";
import { renderPlay } from "./log.ts";
import type { RunResult } from "./report.ts";
import type { ReplayAction } from "./replay.ts";

const cards: Card[] = [
  { id: "strike", name: "타격", patron: "zeus", cost: 1, target: "enemy", effects: [{ op: "damage", value: 7 }], tags: ["attack"] },
  { id: "stormguard", name: "폭풍 방벽", patron: "zeus", cost: 1, target: "self", effects: [{ op: "block", value: 6 }], tags: ["defend"] },
  { id: "guard", name: "방어", patron: "athena", cost: 1, target: "self", effects: [{ op: "block", value: 6 }], tags: ["defend"] },
  { id: "spark", name: "불꽃", patron: "zeus", cost: 1, target: "enemy", effects: [{ op: "damage", value: 4 }], tags: ["attack"] },
  { id: "aegis", name: "아이기스", patron: "athena", cost: 1, target: "enemy", effects: [{ op: "damage", value: 4 }], tags: ["attack"] },
  { id: "wave", name: "파도", patron: "poseidon", cost: 1, target: "enemy", effects: [{ op: "damage", value: 7 }], tags: ["attack"] },
  { id: "undertow", name: "역조", patron: "poseidon", cost: 1, target: "enemy", effects: [{ op: "damage", value: 4 }], tags: ["attack"] },
  { id: "sea_guard", name: "해류 방벽", patron: "poseidon", cost: 1, target: "self", effects: [{ op: "block", value: 6 }], tags: ["defend"] },
  { id: "spear", name: "지혜의 창", patron: "athena", cost: 1, target: "enemy", effects: [{ op: "damage", value: 7 }], tags: ["attack"] },
  { id: "slash", name: "참격", patron: "ares", cost: 1, target: "enemy", effects: [{ op: "damage", value: 7 }], tags: ["attack"] },
  { id: "fury", name: "광전", patron: "ares", cost: 1, target: "enemy", effects: [{ op: "damage", value: 4 }], tags: ["attack"] },
  { id: "war_guard", name: "전쟁 방벽", patron: "ares", cost: 1, target: "self", effects: [{ op: "block", value: 6 }], tags: ["defend"] },
  { id: "shot", name: "사냥 화살", patron: "artemis", cost: 1, target: "enemy", effects: [{ op: "damage", value: 7 }], tags: ["attack"] },
  { id: "focus", name: "달의 조준", patron: "artemis", cost: 1, target: "enemy", effects: [{ op: "damage", value: 4 }], tags: ["attack"] },
  { id: "moon_guard", name: "달빛 방벽", patron: "artemis", cost: 1, target: "self", effects: [{ op: "block", value: 6 }], tags: ["defend"] },
];
const godDecks: Record<GodId, [string, string, string]> = {
  zeus: ["strike", "stormguard", "spark"],
  poseidon: ["wave", "sea_guard", "undertow"],
  athena: ["spear", "guard", "aegis"],
  ares: ["slash", "war_guard", "fury"],
  artemis: ["shot", "moon_guard", "focus"],
};
export type PatronPair = readonly [GodId, GodId];
export type Scenario = "grace_4" | "grace_6" | "fused_deck";
// ponytail: global damage/block calibration. Raise or lower it here; the per-pairing knob it used to
// feed only ever emitted 1e-6 nudges, which cannot move a win rate.
export const baseCardBalance = -0.1;
const tunedCards = cards.map((card) => ({
  ...card,
  effects: card.effects.map((effect) => (effect.op === "damage" || effect.op === "block")
    ? { ...effect, value: Math.max(0, (effect.value ?? 0) + baseCardBalance) }
    : effect),
}));
type CardData = Omit<Card, "patronPair"> & { patron_pair?: [Card["patron"], Card["patron"]] };
const fusionCards = (cardDataJson as CardData[])
  .filter(({ patron_pair }) => patron_pair)
  .map(({ patron_pair, ...card }) => ({ ...card, patronPair: patron_pair } as Card));

type EnemyData = {
  id: string;
  region: string;
  tier: "normal" | "boss";
  role: string;
  hp: number;
  pattern: { op: string; value?: number; token?: import("../core/state.ts").TokenName; stacks?: number; repeat?: number }[];
  groups?: { id: string; with: string[] }[];
};
const enemyData = enemyDataJson as EnemyData[];

function enemyDefinition(enemy: EnemyData): EnemyDefinition {
  return {
    id: enemy.id,
    hp: enemy.hp,
    bulwark: enemy.role === "bulwark" ? enemy.pattern.find(({ token }) => token === "bulwark")?.stacks : undefined,
    pattern: enemy.pattern.map((effect) => ({
      damage: effect.op === "damage" ? Math.ceil((effect.value ?? 0) * (effect.repeat ?? 1) * enemyDamageScale) : undefined,
      block: effect.op === "block" ? effect.value : undefined,
      token: effect.op === "apply_token" ? effect.token : undefined,
      stacks: effect.stacks,
    })),
  };
}

function encounter(seed: number, region: string, boss = false): EnemyDefinition[] {
  const candidates = enemyData.filter((enemy) => enemy.region === region && (enemy.tier === "boss") === boss);
  const root = candidates[seed % candidates.length];
  if (boss) return [enemyDefinition(root)];
  const group = root.groups![seed % root.groups!.length];
  return [root, ...group.with.map((id) => enemyData.find((enemy) => enemy.id === id)!)].map(enemyDefinition);
}

function playEncounter(state: GameState, seed: number, deck: string[], cardMap: Map<string, Card>, enemies: EnemyDefinition[], log: string[], patrons: PatronPair) {
  const enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const random = createRng(seed);
  const hp = state.combat.player.hp;
  state.combat = createCombat(seed, deck, enemies);
  state.combat.player.hp = hp;
  const uses: FavorUses = {};
  let blockBuilt = 0;
  let blockAbsorbed = 0;
  const targetSpread: ("single" | "multi")[] = [];
  const cardsPlayed: string[] = [];

  while (state.combat.outcome === "ongoing") {
    startTurn(state.combat, random);
    while (state.combat.outcome === "ongoing") {
      const cardId = chooseCard(state.combat, cardMap, enemyMap, state.favor);
      if (!cardId) break;
      const card = cardMap.get(cardId)!;
      cardsPlayed.push(cardId);
      const target = chooseTarget(card, state.combat, enemyMap);
      blockBuilt += card.effects.reduce((sum, effect) => sum + (effect.op === "block" ? effect.value ?? 0 : 0), 0);
      targetSpread.push(card.target === "all_enemies" || card.effects.some(({ op }) => op === "chain") ? "multi" : "single");
      playCard(state, cardMap, cardId, target);
      if (card.patron) recordCardFavor(state.favor, card.patron, uses);
      log.push(`node=${state.map.node + 1} ${renderPlay(state.combat, card, target)}`);
    }
    if (state.combat.outcome === "ongoing") {
      const block = state.combat.player.block;
      endTurn(state.combat, enemyMap);
      blockAbsorbed += Math.max(0, block - state.combat.player.block);
    }
  }
  finishCombatFavor(state.favor, [...patrons], uses);
  return { turns: state.combat.turn, blockBuilt, blockAbsorbed, targetSpread, uses, cardsPlayed };
}

export function run(seed: number, scenario?: Scenario, scriptedActions: ReplayAction[] = [], patrons: PatronPair = ["zeus", "athena"]): RunResult {
  const fusedCard = fusionCards.find(({ patronPair }) => patrons.every((god) => patronPair?.includes(god)))!;
  const startingDeck = [
    godDecks[patrons[0]][0], godDecks[patrons[0]][0], godDecks[patrons[0]][1], godDecks[patrons[0]][1], godDecks[patrons[0]][2],
    godDecks[patrons[1]][0], godDecks[patrons[1]][0], godDecks[patrons[1]][0], godDecks[patrons[1]][1], godDecks[patrons[1]][2],
  ];
  const deck = [...startingDeck, ...(scenario === "fused_deck" ? [fusedCard.id] : [])];
  const cardMap = new Map([...tunedCards, ...fusionCards].map((card) => [card.id, structuredClone(card)]));
  const graced = scenario === "grace_4" ? 4 : scenario === "grace_6" ? 6 : 0;
  const state: GameState = {
    seed,
    combat: createCombat(seed, deck, []),
    favor: { [patrons[0]]: graced ? 70 : 50, [patrons[1]]: 50 },
    grace: { [patrons[0]]: graced, [patrons[1]]: 0 },
    map: { node: 0, completed: [] },
  };
  const log: string[] = [];
  const favorCurve = [{ ...state.favor }];
  const hpCurve = [state.combat.player.hp];
  const pathChoices: ("combat" | "rest")[] = [];
  const restChoices: ("heal" | "remove")[] = [];
  const regionsCleared: string[] = [];
  let encounters = 0;
  let restCount = 0;
  let turns = 0;
  let upgrades = 0;
  let blockBuilt = 0;
  let blockAbsorbed = 0;
  const enemyCounts: number[] = [];
  const targetSpread: ("single" | "multi")[] = [];
  const cardsPlayed: string[] = [];
  let fused = scenario === "fused_deck";
  const actions: ReplayAction[] = [];
  let actionIndex = 0;

  const applyMilestones = (god: string, value: number) => {
    const cardId = godDecks[god as GodId]?.[0];
    if (!cardId) return;
    if (value === 2) {
      cardMap.set(cardId, upgradeCard(cardMap.get(cardId)!));
      upgrades += 1;
    }
    if (value === 6) cardMap.set(cardId, reduceCardCost(cardMap.get(cardId)!));
  };
  if (graced >= 2) applyMilestones(patrons[0], 2);
  if (graced >= 6) applyMilestones(patrons[0], 6);

  while (state.map.node < 12 && state.combat.player.hp > 0) {
    const node = mapNode(state.map.node);
    const optional = node.options.includes("rest");
    const scripted = optional ? scriptedActions[actionIndex++] : undefined;
    const path = optional ? scripted?.choice ?? choosePath(state.combat.player.hp, state.combat.player.maxHp) : node.options[0];
    if (optional) {
      if (path !== "combat" && path !== "rest") throw new Error(`Invalid path action: ${path}`);
      pathChoices.push(path);
      actions.push({ type: "path", choice: path });
    }
    if (path === "rest") {
      const rest = chooseRest(state.combat.player.hp, state.combat.player.maxHp);
      const cardId = rest === "remove" ? chooseRestCard(deck, cardMap, state.combat) : undefined;
      takeRest(state, [...patrons], deck, rest, cardId);
      restChoices.push(rest);
      restCount += 1;
      advanceMap(state, "rest");
    } else {
      const enemies = encounter(seed + state.map.node, node.region, path === "boss");
      const result = playEncounter(state, seed * 100 + state.map.node, deck, cardMap, enemies, log, patrons);
      turns += result.turns;
      blockBuilt += result.blockBuilt;
      blockAbsorbed += result.blockAbsorbed;
      targetSpread.push(...result.targetSpread);
      cardsPlayed.push(...result.cardsPlayed);
      enemyCounts.push(enemies.length);
      encounters += 1;
      if (state.combat.outcome !== "victory") {
        favorCurve.push({ ...state.favor });
        hpCurve.push(state.combat.player.hp);
        break;
      }
      if ((seed + state.map.node) % 5 < 3) {
        const seekFusion = patrons.includes("artemis") && (state.grace[patrons[0]] ?? 0) >= 6;
        const demandIndex = seekFusion ? (seed + state.map.node) % 2 : 0;
        resolveDemand(state.favor, patrons[demandIndex], patrons[1 - demandIndex], true);
      }
      if (!fused && canFuse(state.favor, result.uses, patrons)) {
        deck.push(fusedCard.id);
        fused = true;
      }
      const god = awardGrace(state.favor, state.grace, [...patrons]);
      if (god && [2, 6].includes(state.grace[god])) applyMilestones(god, state.grace[god]);
      advanceMap(state, path);
      if (node.floor === 6) regionsCleared.push(node.region);
    }
    favorCurve.push({ ...state.favor });
    hpCurve.push(state.combat.player.hp);
  }
  const won = state.map.node === 12 && state.combat.player.hp > 0;
  log.push(`outcome=${won ? "victory" : state.combat.outcome} encounters=${encounters} turns=${turns} hp=${state.combat.player.hp}`);
  return { won, turns, log, favorCurve, encounters, restCount, hpCurve, pathChoices, restChoices, regionsCleared, grace: state.grace, upgrades, scenario, enemyCounts, targetSpread, blockBuilt, blockAbsorbed, fused, actions, cardsPlayed, pairing: patrons.join("+") };
}

export function simulate(runs: number, scenario?: Scenario): RunResult[] {
  return Array.from({ length: runs }, (_, index) => run(index + 1, scenario));
}

const gods: GodId[] = ["zeus", "poseidon", "athena", "ares", "artemis"];
const pairings = gods.flatMap((left, index) => gods.slice(index + 1).map((right) => [left, right] as const));

export function simulateStratified(runs: number): RunResult[] {
  if (runs % pairings.length !== 0) throw new Error(`--stratified runs must be divisible by ${pairings.length}`);
  return Array.from({ length: runs }, (_, index) => {
    const pairing = pairings[index % pairings.length];
    const seed = Math.floor(index / pairings.length) + 1;
    const key = pairing.join("+");
    const result = run(seed, undefined, [], pairing);
    return {
      ...result,
      pairing: key,
      conflictPenalty: demandPenalty(pairing[0], pairing[1]).key,
      conflictChoice: pairing[0],
    };
  });
}

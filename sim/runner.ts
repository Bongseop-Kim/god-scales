import { createCombat, endTurn, playCard, startTurn, type EnemyDefinition } from "../core/combat.ts";
import { createRng } from "../core/rng.ts";
import type { Card } from "../core/rules.ts";
import type { GameState } from "../core/state.ts";
import { chooseCard, chooseTarget } from "./bots/rule.ts";
import { renderPlay } from "./log.ts";
import { renderReport, summarize, type RunResult } from "./report.ts";

const cards: Card[] = [
  { id: "strike", name: "타격", patron: "ares", cost: 1, target: "enemy", effects: [{ op: "damage", value: 7 }], tags: ["attack"] },
  { id: "guard", name: "방어", patron: "athena", cost: 1, target: "self", effects: [{ op: "block", value: 6 }], tags: ["defend"] },
  { id: "spark", name: "불꽃", patron: "zeus", cost: 1, target: "enemy", effects: [{ op: "damage", value: 4 }, { op: "apply_token", token: "shock", stacks: 1 }], tags: ["attack", "token"] },
];
const startingDeck = ["strike", "strike", "strike", "strike", "strike", "guard", "guard", "guard", "spark", "spark"];

function encounter(seed: number): EnemyDefinition[] {
  if (seed % 3 === 0) return [{ id: "brute", hp: 75, pattern: [{ damage: 14 }, { damage: 8 }] }];
  if (seed % 3 === 1) return [{ id: "raider", hp: 45, pattern: [{ damage: 9 }] }];
  return [
    { id: "raider_a", hp: 32, pattern: [{ damage: 7 }] },
    { id: "raider_b", hp: 32, pattern: [{ damage: 10 }] },
  ];
}

export function run(seed: number): RunResult {
  const enemies = encounter(seed);
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const random = createRng(seed);
  const state: GameState = {
    seed,
    combat: createCombat(seed, startingDeck, enemies),
    favor: { zeus: 50, athena: 50, ares: 50 },
    map: { node: 0, completed: [] },
  };
  const log: string[] = [];

  while (state.combat.outcome === "ongoing") {
    startTurn(state.combat, random);
    while (state.combat.outcome === "ongoing") {
      const cardId = chooseCard(state.combat, cardMap, enemyMap);
      if (!cardId) break;
      const card = cardMap.get(cardId)!;
      const target = chooseTarget(card, state.combat, enemyMap);
      playCard(state, cardMap, cardId, target);
      log.push(renderPlay(state.combat, card, target));
    }
    if (state.combat.outcome === "ongoing") endTurn(state.combat, enemyMap);
  }
  log.push(`outcome=${state.combat.outcome} turns=${state.combat.turn} hp=${state.combat.player.hp}`);
  return { won: state.combat.outcome === "victory", turns: state.combat.turn, log };
}

export function simulate(runs: number): RunResult[] {
  return Array.from({ length: runs }, (_, index) => run(index + 1));
}

function parseRuns(args: string[]): { runs: number; log: boolean } {
  const index = args.indexOf("--runs");
  const runs = index < 0 ? 200 : Number(args[index + 1]);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  return { runs, log: args.includes("--log") };
}

if (process.argv[1]?.endsWith("runner.ts")) {
  const options = parseRuns(process.argv.slice(2));
  const results = simulate(options.runs);
  if (options.log) console.log(results[0].log.join("\n"));
  console.log(renderReport(summarize(results)));
}

import cardsJson from "../data/cards.json" with { type: "json" };
import { createCombat } from "../core/combat.ts";
import { executeCard, firePowers, type Card } from "../core/rules.ts";
import type { GameState } from "../core/state.ts";

const cards = cardsJson as Card[];
const snapshot = ({ combat, favor }: GameState) => JSON.stringify({
  favor,
  player: combat.player,
  energy: combat.energy,
  hand: combat.hand,
  drawPile: combat.drawPile,
  enemies: combat.enemies,
});

const failures: string[] = [];
const noops: string[] = [];

for (const card of cards) {
  const enemies = Array.from({ length: 4 }, (_, slot) => ({ id: `dummy_${slot}`, hp: 100, pattern: [{}] }));
  const combat = createCombat(1, Array(20).fill("draw"), enemies);
  combat.turn = 10;
  combat.energy = 10;
  combat.player.hp = 40;
  combat.player.block = 20;
  combat.turnPlays = { cards_played: 4, attacks: 4, energy_spent: 4 };
  for (const enemy of combat.enemies) {
    enemy.hp = 20;
    enemy.tokens.mark = 1;
  }
  const state: GameState = {
    seed: 1,
    combat,
    favor: { zeus: 100, poseidon: 100, athena: 100, ares: 100, artemis: 100 },
    grace: {},
    map: { depth: 0, lane: 1, grid: [], completed: [] },
  };
  const slot = card.effects.some(({ when }) => when?.startsWith("slot(target) >=")) ? 2 : Number(card.reach?.[0] ?? 0);
  const target = combat.enemies[slot]?.id;
  const before = snapshot(state);
  try {
    if (card.tags.includes("power")) {
      if (!card.trigger) throw new Error("power card without trigger");
      combat.powers.push({ trigger: card.trigger, card });
      firePowers(state, card.trigger, target, () => 0);
    } else executeCard(state, card, card.target === "enemy" ? target : undefined, cards, () => 0);
    if (snapshot(state) === before) noops.push(card.id);
  } catch (error) {
    failures.push(`${card.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`cards=${cards.length} failures=${failures.length} noops=${noops.length}`);
for (const failure of failures) console.log(`FAIL ${failure}`);
for (const id of noops) console.log(`NOOP ${id}`);
if (failures.length || noops.length) process.exitCode = 1;

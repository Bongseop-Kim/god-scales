import { describe, expect, it } from "vitest";
import { trainingEnemy } from "../core/__fixtures__/enemies";
import {
  createCombat,
  drawCards,
  effectiveHp,
  runCombat,
  startTurn,
  type EnemyDefinition,
} from "../core/combat";
import { createRng } from "../core/rng";
import { dealDamage, type Card } from "../core/rules";

const strike: Card = {
  id: "strike",
  name: "타격",
  patron: "ares",
  cost: 1,
  target: "enemy",
  effects: [{ op: "damage", value: 6 }],
  tags: ["attack"],
};

describe("combat", () => {
  it("finishes a fixture combat and replays every turn", () => {
    const deck = Array(10).fill("strike");
    const first = runCombat(42, deck, [strike], [trainingEnemy]);
    const second = runCombat(42, deck, [strike], [trainingEnemy]);
    expect(first.state.combat.outcome).toMatch(/victory|defeat/);
    expect(first.snapshots).toEqual(second.snapshots);
  });

  it("clears block but keeps bulwark at turn start", () => {
    const combat = createCombat(1, [], [trainingEnemy]);
    combat.player.block = 4;
    combat.player.tokens.bulwark = 5;
    startTurn(combat, createRng(1));
    expect([combat.player.block, combat.player.tokens.bulwark, combat.energy]).toEqual([0, 5, 3]);
  });

  it("spends block, then bulwark, then HP", () => {
    const attacker = { id: "enemy", hp: 10, maxHp: 10, block: 0, tokens: {} };
    const target = { id: "player", hp: 10, maxHp: 10, block: 2, tokens: { bulwark: 3 } };
    dealDamage(attacker, target, 6);
    expect([target.block, target.tokens.bulwark, target.hp]).toEqual([0, undefined, 9]);
  });

  it("reshuffles discard, stops on empty piles, and respects the hand limit", () => {
    const combat = createCombat(1, [], [trainingEnemy]);
    combat.discardPile = ["a", "b"];
    drawCards(combat, 2, createRng(2));
    expect(combat.hand.sort()).toEqual(["a", "b"]);
    drawCards(combat, 5, createRng(2));
    expect(combat.hand).toHaveLength(2);

    combat.drawPile = ["kept"];
    combat.hand = Array(10).fill("full");
    drawCards(combat, 1, createRng(2));
    expect(combat.drawPile).toEqual(["kept"]);
  });

  it("removes exhausted cards for the rest of combat", () => {
    const exhaust = { ...strike, id: "exhaust", tags: ["attack", "exhaust"] as Card["tags"] };
    const result = runCombat(2, ["exhaust", ...Array(9).fill("strike")], [strike, exhaust], [trainingEnemy]);
    expect(result.state.combat.drawPile).not.toContain("exhaust");
    expect(result.state.combat.discardPile).not.toContain("exhaust");
    expect(result.state.combat.hand).not.toContain("exhaust");
  });

  it("times out after 50 turns", () => {
    const wall: EnemyDefinition = { id: "wall", hp: 999, pattern: [{ block: 1 }] };
    const result = runCombat(3, Array(10).fill("strike"), [{ ...strike, effects: [] }], [wall]);
    expect([result.state.combat.turn, result.state.combat.outcome, result.state.combat.timeout]).toEqual([51, "timeout", true]);
  });

  it("counts bulwark as effective HP", () => {
    const enemy = createCombat(1, [], [{ ...trainingEnemy, bulwark: 7 }]).enemies[0];
    expect(effectiveHp(enemy)).toBe(37);
  });
});

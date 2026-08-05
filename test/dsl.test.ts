import { describe, expect, it } from "vitest";
import { operatorCards } from "../core/__fixtures__/cards";
import {
  dealDamage,
  evaluateCondition,
  executeCard,
  loadCards,
  takeEnemyTurn,
  tickBleed,
  type Card,
} from "../core/rules";
import type { ActorState, GameState } from "../core/state";

const actor = (id: string, hp = 20): ActorState => ({ id, hp, maxHp: hp, block: 0, tokens: {} });
const state = (): GameState => ({
  seed: 1,
  favor: { zeus: 70, poseidon: 20 },
  grace: {},
  graceSlots: {},
  map: { depth: 0, lane: 1, grid: [], completed: [] },
  combat: {
    turn: 3,
    energy: 0,
    outcome: "ongoing",
    timeout: false,
    player: actor("player", 20),
    drawPile: ["a", "b"],
    hand: [],
    discardPile: [],
    powers: [],
    enemies: [
      { ...actor("a", 20), patternIndex: 0 },
      { ...actor("b", 20), patternIndex: 0 },
      { ...actor("c", 20), patternIndex: 0 },
    ],
  },
});
const card = (target: Card["target"], effects: Card["effects"]): Card => ({
  id: "fixture",
  name: "fixture",
  patron: "zeus",
  cost: 0,
  target,
  effects,
  tags: ["attack"],
});

describe("DSL operators", () => {
  it("executes every common operator", () => {
    for (const fixture of operatorCards) executeCard(state(), fixture, "a");
  });

  it("routes beneficial effects on mixed fusion cards to the player", () => {
    const combat = state();
    executeCard(combat, card("enemy", [{ op: "damage", value: 4 }, { op: "block", value: 3 }, { op: "apply_token", token: "bulwark", stacks: 2 }]), "a");
    expect(combat.combat.enemies[0]).toMatchObject({ hp: 16, block: 0, tokens: {} });
    expect(combat.combat.player).toMatchObject({ block: 3, tokens: { bulwark: 2 } });
  });

  it("chains only to secondary enemies", () => {
    const combat = state();
    executeCard(combat, card("enemy", [{ op: "chain", value: 4 }]), "a");
    expect(combat.combat.enemies.map(({ hp }) => hp)).toEqual([20, 16, 16]);

    const solo = state();
    solo.combat.enemies.splice(1);
    expect(() => executeCard(solo, card("enemy", [{ op: "chain", value: 4 }]), "a")).not.toThrow();
    expect(solo.combat.enemies[0].hp).toBe(20);
  });

  it("rejects chain on all-enemy cards while loading", () => {
    expect(() => loadCards([card("all_enemies", [{ op: "chain", value: 4 }])])).toThrow(/target enemy/);
  });
});

describe("tokens", () => {
  it("applies each duration rule", () => {
    const bleeding = actor("bleeding");
    bleeding.tokens.bleed = 3;
    expect([tickBleed(bleeding), tickBleed(bleeding), tickBleed(bleeding)]).toEqual([3, 2, 1]);
    expect(bleeding.hp).toBe(14);

    const attacker = actor("attacker");
    const defender = actor("defender");
    defender.tokens.deflect = 1;
    expect(dealDamage(attacker, defender, 4)).toBe(0);
    expect([attacker.hp, defender.hp, defender.tokens.deflect]).toEqual([16, 20, undefined]);

    defender.tokens.bulwark = 5;
    dealDamage(attacker, defender, 3);
    expect([defender.hp, defender.tokens.bulwark]).toEqual([20, 2]);

    attacker.tokens.crit = 1;
    dealDamage(attacker, defender, 2);
    expect(attacker.tokens.crit).toBeUndefined();

    const displaced = { ...actor("enemy"), patternIndex: 2 };
    displaced.tokens.displace = 1;
    expect(takeEnemyTurn(displaced)).toBe(false);
    expect(displaced.patternIndex).toBe(2);
  });

  // 적 패턴은 `target: self`로 아무 토큰이나 붙일 수 있다 — 양쪽이 가시를 들면 반사가 무한히 튕겼다
  it("stops thorns at one bounce", () => {
    const left = actor("left", 100);
    const right = actor("right", 100);
    left.tokens.thorns = 1;
    right.tokens.thorns = 1;
    expect(dealDamage(left, right, 5)).toBe(5);
    expect([right.hp, left.hp]).toEqual([95, 99]);
  });
});

describe("conditions", () => {
  it.each([
    ["favor(patron) >= 70", "favor(patron) >= 71"],
    ["favor(poseidon) < 30", "favor(poseidon) < 20"],
    ["has_token(target, shock) >= 1", "has_token(target, shock) >= 2"],
    ["turn > 2", "turn > 3"],
    ["hp_pct(self) < 60", "hp_pct(self) < 50"],
    ["deck_count(attack) >= 1", "deck_count(attack) >= 2"],
    ["enemy_count() >= 3", "enemy_count() >= 4"],
  ])("evaluates %s", (truthy, falsy) => {
    const combat = state();
    combat.combat.player.hp = 10;
    combat.combat.enemies[0].tokens.shock = 1;
    const fixture = card("enemy", []);
    const context = { state: combat, card: fixture, target: combat.combat.enemies[0], deckCards: [fixture] };
    expect(evaluateCondition(truthy, context)).toBe(true);
    expect(evaluateCondition(falsy, context)).toBe(false);
  });
});

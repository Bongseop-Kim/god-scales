import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCombat } from "../core/combat";
import { awardGrace } from "../core/favor";
import { graceOffer, graceTier, type Grace } from "../core/grace";
import { cardEffects, cardLevel, sealId, upgradeId, type Card } from "../core/rules";
import type { GameState } from "../core/state";
import { materializeCard, runSteps, simulate } from "../sim/engine";
import { summarize } from "../sim/report";

const graces = JSON.parse(readFileSync("data/graces.json", "utf8")) as Grace[];
const cards = JSON.parse(readFileSync("data/cards.json", "utf8")) as Card[];
const row = (id: string, tier: number) => graces.find((grace) => grace.id === id && grace.tier === tier)!;

describe("grace", () => {
  it("awards devoted patrons and ladders the frozen tier", () => {
    const earned: Record<string, number> = {};
    expect(awardGrace({ zeus: 70, athena: 69 }, earned, ["zeus", "athena"])).toEqual(["zeus"]);
    expect(awardGrace({ zeus: 70, athena: 70 }, earned, ["zeus", "athena"])).toEqual(["zeus", "athena"]);
    expect([0, 1, 3, 4, 5, 6].map(graceTier)).toEqual([2, 2, 2, 4, 4, 6]);
    expect(graceOffer(graces, "zeus", 4)).toHaveLength(3);
  });

  it("keeps seal and upgrade identity independent and appends seal effects", () => {
    const base = cards.find(({ patron }) => patron === "zeus")!;
    const grace = row("grace_athena_attack_damage", 4);
    const sealedThenRaised = upgradeId(sealId(base.id, grace));
    const raisedThenSealed = sealId(upgradeId(base.id), grace);
    expect(sealedThenRaised).toBe(raisedThenSealed);
    expect(cardLevel(sealedThenRaised)).toEqual({ base: base.id, level: 1 });
    const card = materializeCard(base, sealedThenRaised, graces);
    expect(card.seals).toEqual([grace]);
    expect(card.effects.slice(-grace.effects.length)).toEqual(grace.effects);
  });

  it("seals only one copy and excludes that card from the same god's next choice", () => {
    const steps = runSteps(4, "grace_4");
    const grace = steps.next();
    if (grace.done || grace.value.phase !== "grace") throw new Error("expected grace");
    const cardStep = steps.next(grace.value.bot);
    if (cardStep.done || cardStep.value.phase !== "grace_card") throw new Error("expected grace card");
    expect(cardStep.value.observation.deck).not.toContainEqual(expect.objectContaining({ previewSeal: expect.anything() }));
    const duplicate = cardStep.value.options.find((id) => cardStep.value.observation.deck.filter((card) => card.id === id).length > 1)!;
    const before = cardStep.value.observation.deck.filter(({ id }) => id === duplicate).length;
    const next = steps.next(duplicate);
    if (next.done || next.value.phase !== "grace") throw new Error("expected next grace");
    expect(next.value.observation.deck.filter(({ id }) => id === duplicate)).toHaveLength(before - 1);
    const nextCards = steps.next(next.value.bot);
    if (nextCards.done || nextCards.value.phase !== "grace_card") throw new Error("expected next grace card");
    expect(nextCards.value.options).not.toContain(sealId(duplicate, cardStep.value.observation.seal));
  });

  it("still applies sabotage after sealed effects", () => {
    const state = { seed: 1, combat: createCombat(1, [], []), favor: { zeus: 29, athena: 71 }, grace: {}, map: { depth: 0, lane: 1, grid: [], completed: [] } } as GameState;
    const card: Card = { id: "athena", name: "athena", patron: "athena", cost: 1, target: "enemy", tags: [], effects: [{ op: "damage", value: 2 }, { op: "draw", value: 2 }] };
    expect(cardEffects(state, card).map(({ value }) => value)).toEqual([1, 2]);
  });

  it("excludes scenario runs from the base win rate", () => {
    const scenario = summarize(simulate(20, "grace_6"));
    expect([scenario.runs, scenario.scenario_runs, scenario.grace_milestones[6]]).toEqual([0, 20, 1]);
  });
});

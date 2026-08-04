import { describe, expect, it } from "vitest";
import { awardGrace } from "../core/favor";
import { reduceCardCost, upgradeCard } from "../core/upgrade";
import type { Card } from "../core/rules";
import { simulate } from "../sim/engine";
import { summarize } from "../sim/report";

const card: Card = {
  id: "card",
  name: "card",
  patron: "zeus",
  cost: 1,
  target: "enemy",
  effects: [{ op: "damage", value: 5 }, { op: "draw", value: 1 }, { op: "self_damage", value: 2 }, { op: "apply_token", token: "shock", stacks: 1 }],
  tags: ["attack"],
};

describe("grace", () => {
  it("awards one grace only when exactly one patron is devoted", () => {
    const grace: Record<string, number> = {};
    expect(awardGrace({ zeus: 70, athena: 69 }, grace, ["zeus", "athena"])).toBe("zeus");
    expect(grace.zeus).toBe(1);
    expect(awardGrace({ zeus: 70, athena: 70 }, grace, ["zeus", "athena"])).toBeUndefined();
  });

  it("upgrades once with ceiling, excluding self damage, and reduces cost to zero", () => {
    const upgraded = upgradeCard(card);
    expect(upgraded.effects.map(({ value, stacks }) => value ?? stacks)).toEqual([8, 2, 2, 2]);
    expect(upgradeCard(upgraded)).toBe(upgraded);
    expect(reduceCardCost(reduceCardCost(card)).cost).toBe(0);
  });

  it("reaches grace six and excludes scenario runs from base win rate", () => {
    const base = summarize(simulate(500));
    expect(base.grace_milestones[6]).toBeGreaterThan(0);
    const scenario = summarize(simulate(20, "grace_6"));
    expect([scenario.runs, scenario.scenario_runs, scenario.grace_milestones[6]]).toEqual([0, 20, 1]);
  });
});

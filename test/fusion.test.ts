import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canFuse } from "../core/fusion";
import { run, simulate } from "../sim/engine";
import { summarize } from "../sim/report";
import { validateItems } from "../tools/validate";

describe("fusion", () => {
  it("requires both favor and usage on each patron", () => {
    expect(canFuse({ zeus: 70, athena: 70 }, { zeus: 2, athena: 2 }, ["zeus", "athena"])).toBe(true);
    expect(canFuse({ zeus: 70, athena: 69 }, { zeus: 2, athena: 2 }, ["zeus", "athena"])).toBe(false);
    expect(canFuse({ zeus: 70, athena: 70 }, { zeus: 2, athena: 1 }, ["zeus", "athena"])).toBe(false);
  });

  it("passes all ten generated pairings", () => {
    const names = ["ares-artemis", "athena-ares", "athena-artemis", "poseidon-ares", "poseidon-artemis", "poseidon-athena", "zeus-ares", "zeus-artemis", "zeus-athena", "zeus-poseidon"];
    const items = names.map((name) => JSON.parse(readFileSync(`staging/fused-${name}.json`, "utf8")));
    expect(Object.values(validateItems(items).by_pairing)).toEqual(Array(10).fill(1));
  });

  it("injects fused decks outside the base win-rate denominator", () => {
    const report = summarize(simulate(20, "fused_deck"));
    expect([report.runs, report.scenario_runs, report.fusion_rate]).toEqual([0, 20, 1]);
  });

  it("replays strategic actions deterministically", () => {
    const actions = Array.from({ length: 4 }, () => ({ type: "path", choice: "rest" } as const));
    const first = run(1, undefined, actions);
    const second = run(1, undefined, actions);
    expect({ won: first.won, hp: first.hpCurve.at(-1), log: first.log }).toEqual({ won: second.won, hp: second.hpCurve.at(-1), log: second.log });
  });
});

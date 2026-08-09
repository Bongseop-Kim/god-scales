import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Grace } from "../core/grace";
import { sealId, type Card } from "../core/rules";
import { fusionReady, materializeCard, run, runSteps, simulate } from "../sim/engine";
import { summarize } from "../sim/report";
import { validateItems } from "../tools/validate";

describe("fusion", () => {
  it("opens only when one card carries both patrons' seals", () => {
    const graces = JSON.parse(readFileSync("data/graces.json", "utf8")) as Grace[];
    const cards = JSON.parse(readFileSync("data/cards.json", "utf8")) as Card[];
    const base = cards.find(({ patron }) => patron === "zeus")!;
    const seals = [graces.find(({ patron, tier }) => patron === "zeus" && tier === 2)!, graces.find(({ patron, tier }) => patron === "athena" && tier === 2)!];
    const one = materializeCard(base, sealId(base.id, seals[0]), graces);
    const both = materializeCard(base, sealId(sealId(base.id, seals[0]), seals[1]), graces);
    expect(fusionReady(one, ["zeus", "athena"])).toBe(false);
    expect(fusionReady(both, ["zeus", "athena"])).toBe(true);
  });

  it("replaces that deck entry immediately and drops the original seals", () => {
    const steps = runSteps(35, undefined, ["poseidon", "athena"]);
    let step = steps.next();
    while (!step.done) {
      const decision = step.value;
      if (decision.phase === "grace_card") {
        const source = decision.observation.deck.find(({ id }) => id === decision.bot);
        if (source?.fusesTo) {
          const sourceCount = decision.observation.deck.filter(({ id }) => id === source.id).length;
          const resultCount = decision.observation.deck.filter(({ id }) => id === source.fusesTo!.id).length;
          const next = steps.next(decision.bot);
          if (next.done) {
            expect(next.value.fused).toBe(true);
            expect(next.value.actions.at(-1)).toEqual({ type: "grace_card", choice: decision.bot });
            return;
          }
          expect(next.value.observation.deck.filter(({ id }) => id === source.id)).toHaveLength(sourceCount - 1);
          expect(next.value.observation.deck.filter(({ id }) => id === source.fusesTo!.id)).toHaveLength(resultCount + 1);
          expect(next.value.observation.deck.find(({ id }) => id === source.fusesTo!.id)?.seals).toBeUndefined();
          return;
        }
      }
      step = steps.next(decision.bot);
    }
    throw new Error("expected a fusion");
  });

  it("passes all ten generated pairings", () => {
    const names = ["ares-artemis", "athena-ares", "athena-artemis", "poseidon-ares", "poseidon-artemis", "poseidon-athena", "zeus-ares", "zeus-artemis", "zeus-athena", "zeus-poseidon"];
    const items = names.map((name) => JSON.parse(readFileSync(`staging/fused-${name}.json`, "utf8")));
    expect(Object.values(validateItems(items).by_pairing)).toEqual(Array(10).fill(1));
  });

  it("keeps fused scenarios outside the base denominator", () => {
    const report = summarize(simulate(20, "fused_deck"));
    expect([report.runs, report.scenario_runs, report.fusion_rate]).toEqual([0, 20, 1]);
  });

  it("replays strategic actions deterministically", () => {
    const actions = run(1).actions.filter(({ type }) => type === "path");
    const first = run(1, undefined, actions);
    const second = run(1, undefined, actions);
    expect({ won: first.won, hp: first.hpCurve.at(-1), log: first.log, substituted: first.substituted }).toEqual({ won: second.won, hp: second.hpCurve.at(-1), log: second.log, substituted: 0 });
  });
});

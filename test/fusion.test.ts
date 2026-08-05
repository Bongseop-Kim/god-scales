import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canFuse } from "../core/fusion";
import { run, simulate } from "../sim/engine";
import { summarize } from "../sim/report";
import { validateItems } from "../tools/validate";

describe("fusion", () => {
  it("requires one grace earned from each patron and never closes again", () => {
    expect(canFuse({}, ["zeus", "athena"])).toBe(false);
    expect(canFuse({ zeus: 3 }, ["zeus", "athena"])).toBe(false);
    expect(canFuse({ zeus: 3, athena: 1 }, ["zeus", "athena"])).toBe(true);
    // 호의는 조우마다 새지만 획득 수는 안 샌다 — 한 번 열린 합성이 다시 닫히지 않는 이유다
    expect(canFuse({ zeus: 6, athena: 6 }, ["zeus", "athena"])).toBe(true);
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
    // 갈래 문자열이 격자에 달려 있으므로 봇이 실제로 걸은 것을 기록으로 되먹인다 — 대체가 0이어야 한다
    const actions = run(1).actions.filter(({ type }) => type === "path");
    const first = run(1, undefined, actions);
    const second = run(1, undefined, actions);
    expect({ won: first.won, hp: first.hpCurve.at(-1), log: first.log, substituted: first.substituted }).toEqual({ won: second.won, hp: second.hpCurve.at(-1), log: second.log, substituted: 0 });
  });
});

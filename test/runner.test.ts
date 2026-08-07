import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run, simulate } from "../sim/engine";
import { summarize } from "../sim/report";
import { readReplay } from "../sim/replay";

describe("headless runner", () => {
  it("reproduces 200-run results", () => {
    expect(summarize(simulate(200))).toEqual(summarize(simulate(200)));
  });

  it("names targets, effects, and token stacks in logs", () => {
    expect(run(1).log.join("\n")).toMatch(/target=.+ effects=.+ tokens=/);
  });

  /** 조합이 어긋난 채로 재생되면 시작 덱이 달라 봇이 대신 답한다 — 파일을 읽는 자리에서 막는다 */
  it("reads the patron pair, defaults old replays to zeus+athena", () => {
    const dir = mkdtempSync(join(tmpdir(), "replay-"));
    const write = (name: string, body: unknown) => {
      const path = join(dir, `${name}.json`);
      writeFileSync(path, JSON.stringify(body));
      return path;
    };
    const base = { seed: 3, actions: [], replay_mode: "action_log" };

    // `patrons` 없는 옛 로그는 그대로 읽히고, 기본값으로 제우스+아테나 런이 된다
    const old = readReplay(write("old", base));
    expect(old.patrons).toBeUndefined();
    expect(run(old.seed, undefined, old.actions, old.patrons).pairing).toBe("zeus+athena");
    expect(readReplay(write("pair", { ...base, patrons: ["ares", "artemis"] })).patrons).toEqual(["ares", "artemis"]);

    // `null`과 배열 아닌 값도 반려다 — 통과시키면 `patrons.length`·`.every`가 파일을 읽는 자리에서 터진다
    const bad = [["zeus"], ["zeus", "athena", "ares"], ["zeus", "zeus"], ["zeus", "hades"], null, "za", { 0: "zeus", 1: "athena", length: 2 }];
    for (const [index, patrons] of bad.entries()) {
      expect(() => readReplay(write(`bad-${index}`, { ...base, patrons })), JSON.stringify(patrons)).toThrow(/Invalid patrons/);
    }
  });
});

import { describe, expect, it } from "vitest";
import { run, simulate } from "../sim/engine";
import { summarize } from "../sim/report";

describe("headless runner", () => {
  it("reproduces 200-run results", () => {
    expect(summarize(simulate(200))).toEqual(summarize(simulate(200)));
  });

  it("names targets, effects, and token stacks in logs", () => {
    expect(run(1).log.join("\n")).toMatch(/target=.+ effects=.+ tokens=/);
  });
});

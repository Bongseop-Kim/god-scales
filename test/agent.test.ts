import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { consumeAnswer, type PendingDecision } from "../sim/handoff";

describe("LLM handoff", () => {
  it("accepts a valid reasoned choice without fallback", () => {
    const runId = "test-agent";
    const pending: PendingDecision = { turn: 1, phase: "path", observation: {}, options: ["combat", "rest"] };
    mkdirSync(`decisions/${runId}`, { recursive: true });
    writeFileSync(`decisions/${runId}/answer.json`, JSON.stringify({ choice: "rest", reason: "HP를 보존한다" }));
    expect(consumeAnswer(runId, pending)).toEqual({ answer: { choice: "rest", reason: "HP를 보존한다" }, fallback: false });
    rmSync(`decisions/${runId}`, { recursive: true });
  });
});

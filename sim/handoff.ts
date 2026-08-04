import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export type PendingDecision = {
  turn: number;
  phase: "patron_pair" | "path";
  observation: Record<string, unknown>;
  options: string[];
};
export type DecisionAnswer = { choice: string; reason: string };

export function writePending(runId: string, pending: PendingDecision): void {
  mkdirSync(`decisions/${runId}`, { recursive: true });
  writeFileSync(`decisions/${runId}/pending.json`, `${JSON.stringify(pending, null, 2)}\n`);
}

export function consumeAnswer(runId: string, pending: PendingDecision): { answer: DecisionAnswer; fallback: boolean } {
  let answer: DecisionAnswer;
  let fallback = false;
  try {
    answer = JSON.parse(readFileSync(`decisions/${runId}/answer.json`, "utf8")) as DecisionAnswer;
    if (!pending.options.includes(answer.choice) || typeof answer.reason !== "string" || !answer.reason.trim()) throw new Error("invalid answer");
  } catch {
    answer = { choice: pending.options[0], reason: "rule bot fallback" };
    fallback = true;
  }
  appendFileSync(`decisions/${runId}/log.jsonl`, `${JSON.stringify({ pending, answer, fallback })}\n`);
  for (const name of ["pending.json", "answer.json"]) rmSync(`decisions/${runId}/${name}`, { force: true });
  return { answer, fallback };
}

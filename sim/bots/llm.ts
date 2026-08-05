import { readFileSync, writeFileSync } from "node:fs";
import { consumeAnswer, writePending, type PendingDecision } from "../handoff.ts";
import { godDecks } from "../engine.ts";
import type { GodId } from "../../core/rules.ts";
import type { ReplayAction } from "../replay.ts";

type AgentState = {
  seed: number;
  index: number;
  pairing?: string;
  actions: ReplayAction[];
  fallbacks: number;
  decisions: number;
};

const pairings = [
  "zeus+poseidon", "zeus+athena", "zeus+ares", "zeus+artemis", "poseidon+athena",
  "poseidon+ares", "poseidon+artemis", "athena+ares", "athena+artemis", "ares+artemis",
];

function pendingFor(state: AgentState): PendingDecision {
  if (state.index === 0) return {
    turn: 0,
    phase: "patron_pair",
    observation: { favor: 50, deck_size: 10, remaining_floors: 12 },
    options: pairings,
  };
  return {
    turn: state.index,
    phase: "path",
    // 덱은 두 신의 시작 3장을 합친 것이다 — 첫 신만 보내면 에이전트가 절반만 보고 고른다.
    // `pairing`은 consumeAnswer가 options로 검증한 값이라 항상 유효한 신 둘이다
    observation: { favor: { first: 50, second: 50 }, remaining_choice_nodes: 5 - state.index, deck: (state.pairing?.split("+") ?? ["zeus"]).flatMap((god) => godDecks[god as GodId]) },
    options: ["combat", "rest"],
  };
}

export function startAgentRun(runId: string): void {
  const seed = Number(runId);
  if (!Number.isInteger(seed)) throw new Error("run-id must be numeric");
  const state: AgentState = { seed, index: 0, actions: [], fallbacks: 0, decisions: 0 };
  writeFileSync(`decisions/${runId}/state.json`, `${JSON.stringify(state, null, 2)}\n`);
  writeFileSync(`decisions/${runId}/log.jsonl`, "");
  writePending(runId, pendingFor(state));
}

export function resumeAgentRun(runId: string): { complete: false } | { complete: true; state: AgentState } {
  const state = JSON.parse(readFileSync(`decisions/${runId}/state.json`, "utf8")) as AgentState;
  const pending = pendingFor(state);
  const { answer, fallback } = consumeAnswer(runId, pending);
  state.fallbacks += fallback ? 1 : 0;
  state.decisions += 1;
  if (state.index === 0) state.pairing = answer.choice;
  else state.actions.push({ type: "path", choice: answer.choice as "combat" | "rest" });
  state.index += 1;
  writeFileSync(`decisions/${runId}/state.json`, `${JSON.stringify(state, null, 2)}\n`);
  if (state.index < 5) {
    writePending(runId, pendingFor(state));
    return { complete: false };
  }
  return { complete: true, state };
}

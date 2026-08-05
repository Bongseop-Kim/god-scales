import { readFileSync, writeFileSync } from "node:fs";
import { bossLane, generateMap, mapSlot, reachableLanes } from "../../core/map.ts";
import { consumeAnswer, writePending, type PendingDecision } from "../handoff.ts";
import { eliteSlots, godDecks } from "../engine.ts";
import type { GodId } from "../../core/rules.ts";
import type { ReplayAction } from "../replay.ts";

/** 에이전트에게 묻는 갈래 수. 남은 여섯 자리는 재생 때 룰 봇이 채운다 */
const pathAsks = 4;

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

/**
 * 갈래는 격자가 정하고 지금 어디 서 있는지에 달렸다 — 「전투/휴식」 두 값을 적어 둘 수 없다.
 * 격자는 순수 함수라 전투를 돌리지 않고도 `lane ±1`로 열린 칸을 여기서 그대로 낸다
 */
function pendingFor(state: AgentState): PendingDecision {
  if (state.index === 0) return {
    turn: 0,
    phase: "patron_pair",
    observation: { favor: 50, deck_size: 10, remaining_floors: 12 },
    options: pairings,
  };
  const grid = generateMap(state.seed, eliteSlots);
  const depth = state.index - 1;
  const lane = state.actions.length ? Number(state.actions.at(-1)!.choice.split(":")[0]) : bossLane;
  const { region, floor } = mapSlot(depth);
  return {
    turn: state.index,
    phase: "path",
    // 덱은 두 신의 시작 3장을 합친 것이다 — 첫 신만 보내면 에이전트가 절반만 보고 고른다.
    // `pairing`은 consumeAnswer가 options로 검증한 값이라 항상 유효한 신 둘이다
    observation: {
      favor: { first: 50, second: 50 },
      place: `${region}:${floor}`,
      remaining_choice_nodes: pathAsks - state.index,
      deck: (state.pairing?.split("+") ?? ["zeus"]).flatMap((god) => godDecks[god as GodId]),
    },
    options: reachableLanes(depth, lane).map((next) => `${next}:${grid[depth][next]}`),
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
  else state.actions.push({ type: "path", choice: answer.choice });
  state.index += 1;
  writeFileSync(`decisions/${runId}/state.json`, `${JSON.stringify(state, null, 2)}\n`);
  if (state.index <= pathAsks) {
    writePending(runId, pendingFor(state));
    return { complete: false };
  }
  return { complete: true, state };
}

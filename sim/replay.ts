import { readFileSync } from "node:fs";

export type ReplayAction =
  | { type: "path"; choice: "combat" | "rest" }
  | { type: "card"; choice: string }
  | { type: "target"; choice: string }
  | { type: "rest"; choice: "heal" | "remove" }
  | { type: "rest_card"; choice: string }
  | { type: "grace"; choice: string }
  | { type: "demand"; choice: "accept" | "reject" }
  /** `choice: ""`는 건너뛰기다. 기록하지 않으면 재생 때 봇이 대신 한 장 집는다 */
  | { type: "reward"; choice: string };
export type ReplayFile = { seed: number; actions: ReplayAction[]; replay_mode: "action_log" };

export function readReplay(path: string): ReplayFile {
  const replay = JSON.parse(readFileSync(path, "utf8")) as ReplayFile;
  if (!Number.isInteger(replay.seed) || replay.replay_mode !== "action_log" || !Array.isArray(replay.actions)) {
    throw new Error(`Invalid replay: ${path}`);
  }
  return replay;
}

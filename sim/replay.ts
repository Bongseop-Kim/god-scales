import { readFileSync } from "node:fs";

export type ReplayAction = { type: "path"; choice: "combat" | "rest" };
export type ReplayFile = { seed: number; actions: ReplayAction[]; replay_mode: "action_log" };

export function readReplay(path: string): ReplayFile {
  const replay = JSON.parse(readFileSync(path, "utf8")) as ReplayFile;
  if (!Number.isInteger(replay.seed) || replay.replay_mode !== "action_log" || !Array.isArray(replay.actions)) {
    throw new Error(`Invalid replay: ${path}`);
  }
  return replay;
}

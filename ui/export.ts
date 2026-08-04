import type { ReplayAction, ReplayFile } from "../sim/replay.ts";

export function replayPayload(seed: number, actions: ReplayAction[]): ReplayFile {
  return { seed, actions, replay_mode: "action_log" };
}

export function downloadReplay(seed: number, actions: ReplayAction[]): void {
  const blob = new Blob([`${JSON.stringify(replayPayload(seed, actions), null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `god-scales-run-${seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

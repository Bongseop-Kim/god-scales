import { mkdirSync, writeFileSync } from "node:fs";
import { resumeAgentRun, startAgentRun } from "./bots/llm.ts";
import { run, simulate, simulateStratified } from "./engine.ts";
import type { GodId } from "../core/rules.ts";
import { readReplay } from "./replay.ts";
import { renderReport, summarize } from "./report.ts";
import type { Scenario } from "./engine.ts";

function parseRuns(args: string[]): { runs: number; log: boolean; stratified: boolean; scenario?: Scenario; replays: string[] } {
  const index = args.indexOf("--runs");
  const runs = index < 0 ? 200 : Number(args[index + 1]);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  const scenarioIndex = args.indexOf("--scenario");
  const scenario = scenarioIndex < 0 ? undefined : args[scenarioIndex + 1];
  if (scenario !== undefined && scenario !== "grace_4" && scenario !== "grace_6" && scenario !== "fused_deck") throw new Error("--scenario must be grace_4, grace_6, or fused_deck");
  const replayIndex = args.indexOf("--replay");
  const replays = replayIndex < 0 ? [] : args.slice(replayIndex + 1).filter((value) => !value.startsWith("--"));
  return { runs, log: args.includes("--log"), stratified: args.includes("--stratified"), scenario, replays };
}

if (process.argv[1]?.endsWith("runner.ts")) {
  const actorIndex = process.argv.indexOf("--actor");
  if (process.argv[actorIndex + 1] === "llm_agent") {
    const runIdIndex = process.argv.indexOf("--run-id");
    const runId = process.argv[runIdIndex + 1];
    if (!runId) throw new Error("--run-id is required for llm_agent");
    if (!process.argv.includes("--resume")) {
      mkdirSync(`decisions/${runId}`, { recursive: true });
      startAgentRun(runId);
      console.log(`pending=decisions/${runId}/pending.json`);
    } else {
      const resumed = resumeAgentRun(runId);
      if (!resumed.complete) console.log(`pending=decisions/${runId}/pending.json`);
      else {
        const parts = resumed.state.pairing?.split("+");
        if (!parts || parts.length !== 2) throw new Error("agent result is missing a patron pair");
        const patrons: import("./engine.ts").PatronPair = [parts[0] as GodId, parts[1] as GodId];
        const result = run(resumed.state.seed, undefined, resumed.state.actions, patrons);
        const actorResult = {
          run_id: runId,
          actor: "llm_agent",
          replay_mode: "action_log",
          pairing: resumed.state.pairing,
          won: result.won,
          fusion_rate: result.fused ? 1 : 0,
          fallbacks: resumed.state.fallbacks,
          decisions: resumed.state.decisions,
          actions: resumed.state.actions,
        };
        writeFileSync(`decisions/${runId}/result.json`, `${JSON.stringify(actorResult, null, 2)}\n`);
        console.log(`complete=decisions/${runId}/result.json won=${result.won}`);
      }
    }
  } else {
    const options = parseRuns(process.argv.slice(2));
    const replays = options.replays.map(readReplay);
    const results = replays.length ? replays.map((replay) => run(replay.seed, undefined, replay.actions)) : options.stratified ? simulateStratified(options.runs) : simulate(options.runs, options.scenario);
    if (options.log) console.log(results[0].log.join("\n"));
    console.log(renderReport(summarize(results)));
  }
}

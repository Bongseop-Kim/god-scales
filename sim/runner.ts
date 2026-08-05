import { mkdirSync, writeFileSync } from "node:fs";
import { policies, setPolicy, type Policy } from "./bots/rule.ts";
import { resumeAgentRun, startAgentRun } from "./bots/llm.ts";
import { run, simulate, simulateStratified } from "./engine.ts";
import type { GodId } from "../core/rules.ts";
import { readReplay } from "./replay.ts";
import { renderReport, summarize } from "./report.ts";
import type { Scenario } from "./engine.ts";

function parseRuns(args: string[]): { runs: number; log: boolean; stratified: boolean; scenario?: Scenario; replays: string[]; policy?: Policy } {
  const index = args.indexOf("--runs");
  const runs = index < 0 ? 200 : Number(args[index + 1]);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  const scenarioIndex = args.indexOf("--scenario");
  const scenario = scenarioIndex < 0 ? undefined : args[scenarioIndex + 1];
  if (scenario !== undefined && scenario !== "grace_4" && scenario !== "grace_6" && scenario !== "fused_deck") throw new Error("--scenario must be grace_4, grace_6, or fused_deck");
  const replayIndex = args.indexOf("--replay");
  const replays = replayIndex < 0 ? [] : args.slice(replayIndex + 1).filter((value) => !value.startsWith("--"));
  const policyIndex = args.indexOf("--policy");
  const policy = policyIndex < 0 ? undefined : args[policyIndex + 1];
  if (policy !== undefined && !policies.includes(policy as Policy)) throw new Error(`--policy must be one of ${policies.join(", ")}`);
  return { runs, log: args.includes("--log"), stratified: args.includes("--stratified"), scenario, replays, policy: policy as Policy | undefined };
}

/**
 * 조우마다 어느 정책이 1위인가. **어느 고정 정책도 모든 조우에서 1등이 아니어야** 조우가 다채로운 것이다.
 * 승률이 아니라 조우 돌파율로 잰다 — 런 승률은 12층 전체의 합이라 조우 하나가 요구하는 답을 지운다
 */
function policyMatrix(runs: number): string {
  const rates = policies.map((name) => {
    setPolicy(name);
    try { return summarize(simulateStratified(runs)).encounter_clear_rate; } finally { setPolicy(undefined); }
  });
  const keys = [...new Set(rates.flatMap(Object.keys))].sort();
  const lines = [`| 조우 | ${policies.join(" | ")} | 1위 | 격차 |`, `|---|${policies.map(() => "---:").join("|")}|---|---:|`];
  const rows = keys.map((key) => {
    const row = policies.map((_, index) => rates[index][key] ?? 0);
    const gap = Math.max(...row) - Math.min(...row);
    // 전 정책이 같은 값이면 1위가 없다 — 그 조우는 답을 요구하지 않는다. 세지 않고 그렇게 적는다
    const winner = gap < 0.01 ? undefined : policies[row.indexOf(Math.max(...row))];
    lines.push(`| ${key} | ${row.map((rate) => `${(rate * 100).toFixed(1)}%`).join(" | ")} | ${winner ?? "—"} | ${(gap * 100).toFixed(1)}%p |`);
    return { winner, gap };
  });
  // 한 정책이 50%를 넘으면 독식이다 — 점유율 줄에 다 있으므로 판정을 한 줄 더 찍지 않는다
  const decided = rows.filter(({ winner }) => winner);
  const share = policies.map((name) => [name, decided.length ? decided.filter(({ winner }) => winner === name).length / decided.length : 0] as const);
  lines.push("", `1위 점유율(${decided.length}/${keys.length} 조우에 1위가 있다): ${share.map(([name, value]) => `${name} ${(value * 100).toFixed(0)}%`).join(" · ")}`);
  lines.push(`격차 10%p 이상: ${rows.filter(({ gap }) => gap >= 0.1).length}/${keys.length} 조우`);
  return lines.join("\n");
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
    if (process.argv.includes("--policy-matrix")) console.log(policyMatrix(options.runs));
    else {
      const replays = options.replays.map(readReplay);
      setPolicy(options.policy);
      const results = replays.length ? replays.map((replay) => run(replay.seed, undefined, replay.actions)) : options.stratified ? simulateStratified(options.runs) : simulate(options.runs, options.scenario);
      setPolicy(undefined);
      if (options.log) console.log(results[0].log.join("\n"));
      console.log(renderReport(summarize(results)));
    }
  }
}

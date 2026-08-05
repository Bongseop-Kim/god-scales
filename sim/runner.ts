import { mkdirSync, writeFileSync } from "node:fs";
import { policies, setPolicy, type Policy } from "./bots/rule.ts";
import { resumeAgentRun, startAgentRun } from "./bots/llm.ts";
import { gods, run, setDevotionAura, simulate, simulateStratified } from "./engine.ts";
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
  const rates: Record<string, number>[] = [];
  /** 정책별 갈래 선택열. 같은 인덱스가 같은 (시드, 조합)이라 경로 일치율을 여기서 잰다 */
  const paths: string[][][] = [];
  for (const name of policies) {
    setPolicy(name);
    try {
      const results = simulateStratified(runs);
      rates.push(summarize(results).encounter_clear_rate);
      // 결과 전체를 넷 다 들고 있으면 힙이 터진다 — 비교에 쓰는 열만 남긴다
      paths.push(results.map(({ pathChoices }) => pathChoices));
    } finally { setPolicy(undefined); }
  }
  const keys = [...new Set(rates.flatMap(Object.keys))].sort();
  const lines = [`| 자리 | ${policies.join(" | ")} | 1위 | 격차 |`, `|---|${policies.map(() => "---:").join("|")}|---|---:|`];
  const rows = keys.map((key) => {
    // 정책이 경로도 고르므로 **가 보지 않은 자리**가 생긴다. 0%로 적으면 「늘 졌다」로 읽히고
    // 1위가 유령 0에서 나온다 — 방문한 정책끼리만 비교한다
    const row = policies.map((_, index) => rates[index][key]);
    const seen = row.filter((rate) => rate !== undefined) as number[];
    const gap = seen.length > 1 ? Math.max(...seen) - Math.min(...seen) : 0;
    // 전 정책이 같은 값이면 1위가 없다 — 그 자리는 답을 요구하지 않는다. 세지 않고 그렇게 적는다
    const winner = gap < 0.01 ? undefined : policies[row.indexOf(Math.max(...seen))];
    lines.push(`| ${key} | ${row.map((rate) => (rate === undefined ? "—" : `${(rate * 100).toFixed(1)}%`)).join(" | ")} | ${winner ?? "—"} | ${(gap * 100).toFixed(1)}%p |`);
    return { winner, gap };
  });
  // 한 정책이 50%를 넘으면 독식이다 — 점유율 줄에 다 있으므로 판정을 한 줄 더 찍지 않는다
  const decided = rows.filter(({ winner }) => winner);
  const share = policies.map((name) => [name, decided.length ? decided.filter(({ winner }) => winner === name).length / decided.length : 0] as const);
  lines.push("", `1위 점유율(${decided.length}/${keys.length} 자리에 1위가 있다): ${share.map(([name, value]) => `${name} ${(value * 100).toFixed(0)}%`).join(" · ")}`);
  lines.push(`격차 10%p 이상: ${rows.filter(({ gap }) => gap >= 0.1).length}/${keys.length} 자리`);
  // 지역 안에서 1위가 몇 종으로 갈리는가. 한 정책이 지역을 통째로 먹으면 층이 다 같은 답을 요구한다
  for (const region of ["underworld", "surface"]) {
    const winners = new Set(rows.flatMap(({ winner }, index) => (winner && keys[index].startsWith(region) ? [winner] : [])));
    lines.push(`${region} 층별 1위 종류: ${winners.size} (${[...winners].join(", ") || "없음"})`);
  }
  // 정책 넷이 같은 시드에서 같은 칸을 고르면 격자가 결정을 만들지 않은 것이다
  let same = 0;
  let total = 0;
  for (let index = 0; index < paths[0].length; index += 1) {
    const walked = paths.map((all) => all[index]);
    for (let step = 0; step < Math.min(...walked.map(({ length }) => length)); step += 1) {
      total += 1;
      if (walked.every((choices) => choices[step] === walked[0][step])) same += 1;
    }
  }
  lines.push(`경로 일치율(정책 넷이 같은 칸을 고른 비율): ${total ? ((same / total) * 100).toFixed(1) : "0.0"}% (${same}/${total} 결정)`);
  return lines.join("\n");
}

/** 개입이 부딪혀야 하는 반응형 패시브 넷. 어느 유형에서도 부호가 같으면 그건 개입이 아니라 보너스다 */
const reactivePassives = ["curl", "angry", "rally", "ward"];

/**
 * 헌신 개입이 조우 유형별로 돌파율에 얼마를 보태는가. **개입만 끄고 같은 시드를 다시 돌려** 차이로 잰다 —
 * 한 판 안에서 「헌신인 조우」와 「아닌 조우」를 비교하면 잘 굴러가는 런이 헌신 쪽에 몰려 부호가 전부
 * 양수로 읽힌다. 유형은 앞에 선 적의 반응형 패시브고, 헌신으로 들어선 조우만 센다(나머지는 개입이 없다)
 */
function auraMatrix(runs: number): string {
  const arm = (off: boolean) => {
    setDevotionAura(off);
    try { return simulateStratified(runs).flatMap(({ encounterOutcomes }) => encounterOutcomes.filter(({ devoted }) => devoted.length)); }
    finally { setDevotionAura(false); }
  };
  const on = arm(false);
  const off = arm(true);
  const groups = [...reactivePassives, "없음"];
  const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined);
  const pick = (outcomes: typeof on, god: string, group: string) => outcomes.filter(({ devoted, passives }) =>
    devoted.includes(god) && (group === "없음" ? !passives.some((name) => reactivePassives.includes(name)) : passives.includes(group)));
  /**
   * 신 × 조우 유형. **개입만 끄고 같은 시드를 다시 돌린 차이**가 셀이고, 부호는 플레이어 쪽이 양수다.
   * 신을 안 가르면 셀 하나가 개입 다섯의 평균이 되고, 아테나의 `deflect`(값 10) 하나가 나머지 넷의
   * 부호를 다 덮는다.
   *
   * 재는 값은 **체력 손실**이다. 돌파율은 `curl`·`angry`가 사는 유일한 자리(저승 3층)가 전 정책
   * 100%라 어떤 기여도 +0.0%p로 눌린다 — 포화된 칸에서는 부호가 생길 수 없다. 손실은 포화되지
   * 않으므로 「이겼지만 더 아팠다」가 여기서 보인다. 돌파율은 요약 줄에 총계로만 남긴다
   */
  const lines = [`| 신 | ${groups.join(" | ")} |`, `|---|${groups.map(() => "---:").join("|")}|`];
  const cells: { god: string; group: string; saved: number; n: number }[] = [];
  for (const god of gods) {
    const row = groups.map((group) => {
      const [withAura, without] = [pick(on, god, group), pick(off, god, group)];
      const [cost, base] = [mean(withAura.map(({ hpLost }) => hpLost)), mean(without.map(({ hpLost }) => hpLost))];
      // 표본이 얇은 칸은 부호가 잡음이다 — 세지 않고 그렇게 적는다
      if (cost === undefined || base === undefined || withAura.length < 30) return `— (${withAura.length})`;
      const saved = base - cost;
      cells.push({ god, group, saved, n: withAura.length });
      return `${saved >= 0 ? "+" : ""}${saved.toFixed(1)}hp (${withAura.length})`;
    });
    lines.push(`| ${god} | ${row.join(" | ")} |`);
  }
  const clear = (outcomes: typeof on) => mean(outcomes.map(({ cleared }) => (cleared ? 1 : 0))) ?? 0;
  const negative = cells.filter(({ saved }) => saved < 0);
  lines.push("", `헌신 조우 표본: 개입 ${on.length} · 무개입 ${off.length} · 돌파율 ${(clear(on) * 100).toFixed(1)}% → ${(clear(off) * 100).toFixed(1)}% (개입 없을 때)`);
  lines.push(`기여가 음수(개입이 손해였다)인 셀: ${negative.length}/${cells.length}${negative.length ? ` (${negative.map(({ god, group }) => `${god}:${group}`).join(", ")})` : ""}`);
  lines.push(`그중 반응형 패시브를 낀 셀: ${negative.filter(({ group }) => group !== "없음").length}/${negative.length}`);
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
    else if (process.argv.includes("--aura-matrix")) console.log(auraMatrix(options.runs));
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

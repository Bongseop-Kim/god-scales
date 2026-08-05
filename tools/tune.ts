import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { simulateStratified } from "../sim/engine.ts";
import { summarize } from "../sim/report.ts";

type Report = ReturnType<typeof summarize>;
/** 회차마다 늘어나는 개입·실패 기록. 코드가 아니라 데이터다 — 소스에 두면 튜닝 함수가 산문으로 자란다 */
type Notes = { human_intervened: string[]; ai_failures: string[] };
const notes = JSON.parse(readFileSync(new URL("../reports/notes.json", import.meta.url), "utf8")) as Notes;

export function buildTuningRecord(before: Report | undefined, after: Report, iteration: number, simulationRuns = after.runs) {
  const enemyRuns = Object.entries(after.enemy_count_dist).reduce((sum, [count, occurrences]) => sum + Number(count) * Number(occurrences), 0);
  const encounters = Object.values(after.enemy_count_dist).reduce<number>((sum, value) => sum + Number(value), 0);
  return {
    loop_iteration: iteration,
    // 폐기된 회차의 분산을 같은 표에 두면 안 된다 — 다른 게임을 잰 숫자다. 그럴 때는 null로 남긴다
    variance_before: before ? before.pairing_win_stddev ** 2 : null,
    variance_after: after.pairing_win_stddev ** 2,
    auto_adjusted: 0,
    enemy_adjusted: 0,
    pairing_flagged: [],
    simulation_runs: simulationRuns,
    discarded: 0,
    // 요구를 수락한 것 중 실제로 지킨 비율. 조건 판정이 붙기 전에는 잴 것이 없어 null이었다
    condition_rate_estimate: Object.keys(after.demand_kept_rate).length ? after.demand_kept_rate : null,
    average_enemy_count: encounters ? enemyRuns / encounters : 0,
    ...notes,
  };
}

if (process.argv[1]?.endsWith("tune.ts")) {
  const iterationIndex = process.argv.indexOf("--iteration");
  const iteration = iterationIndex < 0 ? 1 : Number(process.argv[iterationIndex + 1]);
  if (!Number.isInteger(iteration) || iteration < 1) throw new Error("--iteration must be a positive integer");
  // 직전 회차가 폐기됐으면 읽지 않는다. reports/rounds.json의 discarded가 그 목록이다
  const discarded = (() => {
    try { return (JSON.parse(readFileSync("reports/rounds.json", "utf8")) as { discarded?: number[] }).discarded ?? []; }
    catch { return []; }
  })();
  const beforePath = iteration === 1 ? "reports/round-1.json" : `reports/round-${iteration - 1}/simulation.json`;
  const before = discarded.includes(iteration - 1) ? undefined : JSON.parse(readFileSync(beforePath, "utf8")) as Report;
  const simulationRuns = 2000 * 2 ** (iteration - 1);
  const after = summarize(simulateStratified(simulationRuns));
  const tuning = buildTuningRecord(before, after, iteration, simulationRuns);
  mkdirSync(`reports/round-${iteration}`, { recursive: true });
  writeFileSync(`reports/round-${iteration}/tuning.json`, `${JSON.stringify(tuning, null, 2)}\n`);
  writeFileSync(`reports/round-${iteration}/simulation.json`, `${JSON.stringify(after, null, 2)}\n`);
  console.log(JSON.stringify(tuning, null, 2));
}

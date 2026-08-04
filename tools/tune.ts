import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { simulateStratified } from "../sim/engine.ts";
import { summarize } from "../sim/report.ts";

type Report = ReturnType<typeof summarize>;

export function buildTuningRecord(before: Report, after: Report, iteration: number, simulationRuns = after.runs) {
  const enemyRuns = Object.entries(after.enemy_count_dist).reduce((sum, [count, occurrences]) => sum + Number(count) * Number(occurrences), 0);
  const encounters = Object.values(after.enemy_count_dist).reduce<number>((sum, value) => sum + Number(value), 0);
  return {
    loop_iteration: iteration,
    variance_before: before.pairing_win_stddev ** 2,
    variance_after: after.pairing_win_stddev ** 2,
    auto_adjusted: 0,
    enemy_adjusted: 0,
    pairing_flagged: [],
    simulation_runs: simulationRuns,
    discarded: 0,
    condition_rate_estimate: null,
    average_enemy_count: encounters ? enemyRuns / encounters : 0,
    human_intervened: [
      "P-09: enemyDamageScale 1.0→0.65, 최초 완주율 0% 보정",
      "P-13: 합성 사용자 8런과 층화 시뮬을 근거로 enemyDamageScale 0.65→0.45",
      "P-13: 브라우저 UI 밀도 점검은 사용자 지시로 제외",
      "P-20: 조합 라벨만 바뀌던 실행 결함을 수정하고 botPolicyVersion v1→v2로 올린 뒤 이전 회차 데이터를 폐기·재생성",
    ],
    ai_failures: [
      "초기 층화 러너가 실제 후원 조합 대신 제우스+아테나 규칙을 공통 실행함; P-20에서 실제 조합 덱·호의·합성을 실행하도록 수정",
    ],
  };
}

if (process.argv[1]?.endsWith("tune.ts")) {
  const iterationIndex = process.argv.indexOf("--iteration");
  const iteration = iterationIndex < 0 ? 1 : Number(process.argv[iterationIndex + 1]);
  if (!Number.isInteger(iteration) || iteration < 1) throw new Error("--iteration must be a positive integer");
  const beforePath = iteration === 1 ? "reports/round-1.json" : `reports/round-${iteration - 1}/simulation.json`;
  const before = JSON.parse(readFileSync(beforePath, "utf8")) as Report;
  const simulationRuns = 2000 * 2 ** (iteration - 1);
  const after = summarize(simulateStratified(simulationRuns));
  const tuning = buildTuningRecord(before, after, iteration, simulationRuns);
  mkdirSync(`reports/round-${iteration}`, { recursive: true });
  writeFileSync(`reports/round-${iteration}/tuning.json`, `${JSON.stringify(tuning, null, 2)}\n`);
  writeFileSync(`reports/round-${iteration}/simulation.json`, `${JSON.stringify(after, null, 2)}\n`);
  console.log(JSON.stringify(tuning, null, 2));
}

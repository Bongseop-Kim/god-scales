import { favorBoundaries, favorStage, type FavorStage } from "../core/favor.ts";
import { summarize, type RunResult } from "./report.ts";

/**
 * 통계 페이지(`stats.html`)가 읽는 집계. **리포트이지 게이트가 아니다** — 판정·밴드를 여기 넣지 않는다.
 * `summarize()`가 이미 세는 것은 그대로 가져오고, 페이지에만 필요한 것(Δ 분포·승패 그룹 비교)만 여기서 센다
 */
export type StatsPayload = ReturnType<typeof computeStats>;

const stageNames = Object.keys(favorBoundaries) as FavorStage[];
const round = (value: number) => Math.round(value * 1000) / 1000;

function stageShare(points: number[]) {
  const total = points.length || 1;
  const share = Object.fromEntries(stageNames.map((stage) => [stage, 0])) as Record<FavorStage, number>;
  for (const value of points) share[favorStage(value)] += 1;
  for (const stage of stageNames) share[stage] = round(share[stage] / total);
  return share;
}

const patronsOf = ({ pairing }: RunResult) => (pairing ?? "").split("+").filter(Boolean);
const median = (sorted: number[]) => sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;

function groupStats(group: RunResult[]) {
  const demand = group.reduce((all, { demandOutcomes }) => {
    for (const [accepted, kept] of Object.values(demandOutcomes)) { all[0] += accepted; all[1] += kept; }
    return all;
  }, [0, 0]);
  const spreads = group
    .map((result) => { const last = result.favorCurve.at(-1) ?? {}; const [a, b] = patronsOf(result); return Math.abs((last[a] ?? 0) - (last[b] ?? 0)); })
    .sort((left, right) => left - right);
  const per = (total: number) => round(total / (group.length || 1));
  return {
    runs: group.length,
    demandKeptRate: round(demand[0] ? demand[1] / demand[0] : 0),
    demandAcceptedPerRun: per(demand[0]),
    gracePerRun: per(group.reduce((sum, { grace }) => sum + Object.values(grace).reduce((a, b) => a + b, 0), 0)),
    restPerRun: per(group.reduce((sum, { restCount }) => sum + restCount, 0)),
    stageShare: stageShare(group.flatMap(({ favorCurve }) => favorCurve.flatMap((point) => Object.values(point)))),
    finalSpreadMedian: median(spreads),
  };
}

export function computeStats(results: RunResult[]) {
  const report = summarize(results);

  const deltas: number[] = [];
  let crossings = 0;
  for (const result of results) {
    for (const god of patronsOf(result)) {
      for (let i = 1; i < result.favorCurve.length; i++) {
        const before = result.favorCurve[i - 1][god] ?? 0;
        const after = result.favorCurve[i][god] ?? 0;
        deltas.push(after - before);
        if (favorStage(after) !== favorStage(before)) crossings += 1;
      }
    }
  }
  const deltaHist: Record<string, number> = {};
  for (const delta of deltas) deltaHist[delta] = (deltaHist[delta] ?? 0) + 1;
  const absSorted = deltas.map(Math.abs).sort((left, right) => left - right);

  /**
   * 대표 궤적 셋 — 조건 첫 일치라 층화 결과가 결정론이면 선택도 결정론이다.
   * `favorCurve`의 키는 후원 둘뿐이므로 `Object.values`가 곧 그 런의 신 둘이다
   */
  const sampleOf = (label: string, found?: RunResult) => {
    if (!found) return [];
    const gods = patronsOf(found);
    return [{ label, pairing: found.pairing ?? "", won: found.won, gods, points: found.favorCurve.map((point) => gods.map((god) => point[god] ?? 0)) }];
  };
  const samples = [
    ...sampleOf("승리 — 헌신 안착", results.find((r) => r.won && r.favorCurve.some((p) => Object.values(p).some((v) => v >= favorBoundaries.devotion)))),
    ...sampleOf("진노 추락", results.find((r) => r.favorCurve.some((p) => Object.values(p).some((v) => v < favorBoundaries.anger)))),
    ...sampleOf("패배", results.find((r) => !r.won)),
  ];

  const defeatByFloor: Record<string, number> = {};
  for (const { defeatContext } of results) {
    if (!defeatContext) continue;
    const key = `${defeatContext.region}:${defeatContext.floor}`;
    defeatByFloor[key] = (defeatByFloor[key] ?? 0) + 1;
  }

  return {
    meta: {
      runs: report.runs,
      wins: report.wins,
      winRate: round(report.winRate),
      avgEncounters: round(results.reduce((sum, { encounters }) => sum + encounters, 0) / (results.length || 1)),
      botPolicyVersion: report.bot_policy_version,
    },
    favor: {
      steps: deltas.length,
      deltaHist,
      medianAbsDelta: median(absSorted),
      bigShare: round(deltas.length ? absSorted.filter((value) => value >= 12).length / deltas.length : 0),
      crossShare: round(deltas.length ? crossings / deltas.length : 0),
      stageShare: stageShare(results.flatMap(({ favorCurve }) => favorCurve.flatMap((point) => Object.values(point)))),
      samples,
    },
    clear: {
      winRateMatrix: report.win_rate_matrix,
      encounterClearRate: Object.fromEntries(Object.entries(report.encounter_clear_rate).map(([key, value]) => [key, round(value)])),
      defeatByFloor,
      defeatByPassive: Object.fromEntries(Object.entries(report.defeat_by_passive).map(([key, value]) => [key, round(value)])),
    },
    winVsLoss: {
      won: groupStats(results.filter(({ won }) => won)),
      lost: groupStats(results.filter(({ won }) => !won)),
    },
  };
}

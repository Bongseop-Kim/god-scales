import { favorStage } from "../core/favor.ts";
import type { PenaltyKey } from "../core/demands.ts";
import { globalParamVersion } from "../core/favor.ts";
import type { MapGrid } from "../core/map.ts";
import { botPolicyVersion } from "./bots/rule.ts";
import type { RestChoice } from "./replay.ts";

export type RunResult = {
  won: boolean;
  /** 이 런의 격자. 결과 화면이 걸어온 길을 그린다 — 시드로 다시 풀면 같은 사실에 두 경로가 생긴다 */
  grid: MapGrid;
  turns: number;
  log: string[];
  favorCurve: Record<string, number>[];
  pairing?: string;
  conflictPenalty?: PenaltyKey;
  conflictChoice?: string;
  encounters: number;
  restCount: number;
  hpCurve: number[];
  /** `"1:elite"` 꼴 — 갈래와 종류를 같이 든다 */
  pathChoices: string[];
  restChoices: RestChoice[];
  regionsCleared: string[];
  /** 신별 은혜 획득 수 */
  grace: Record<string, number>;
  scenario?: "grace_4" | "grace_6" | "fused_deck";
  enemyCounts: number[];
  targetSpread: ("single" | "multi")[];
  blockBuilt: number;
  blockAbsorbed: number;
  fused: boolean;
  actions: import("./replay.ts").ReplayAction[];
  cardsPlayed: string[];
  /**
   * `요구 id:단`별 [고름, 지킴]. 단이 키에 들어가므로 단별 지킴률을 리포트가 따로 세지 않는다 —
   * 그 단의 대가는 `data/demands.json`이 든다. 거절은 여기 없다(`actions`가 선택 분포를 든다)
   */
  demandOutcomes: Record<string, [number, number]>;
  /**
   * `region:floor:type`별 돌파 여부. 정책 행렬이 「어느 층에서 어느 정책이 1위인가」를 여기서 읽고,
   * `--aura-matrix`가 `passives`(그 조우의 패시브)와 `devoted`(들어설 때 헌신이던 신)로 개입을 잰다
   */
  encounterOutcomes: { key: string; cleared: boolean; passives: string[]; devoted: string[]; hpLost: number }[];
  /** 패배한 조우의 맥락. 「승률이 내려갔다」와 「guard 조우에서만 내려갔다」를 가르는 네 줄 */
  defeatContext?: { region: string; floor: number; enemies: string[]; passives: string[] };
  /** 지금 낼 수 없어서 봇 답으로 대체된 기록된 결정의 수. 0이 아니면 그 로그는 이 규칙판이 아니다 */
  substituted?: number;
};

export function summarize(results: RunResult[]) {
  const baseResults = results.filter(({ scenario }) => !scenario);
  const wins = baseResults.filter(({ won }) => won).length;
  const points = results.flatMap(({ favorCurve }) => favorCurve);
  const gods = [...new Set(points.flatMap(Object.keys))];
  const values = points.flatMap((point) => Object.values(point));
  const ratio = (stage: ReturnType<typeof favorStage>) => values.length ? values.filter((value) => favorStage(value) === stage).length / values.length : 0;
  const conflict_penalty_dist = results.reduce<Record<string, Partial<Record<PenaltyKey, number>>>>((all, result) => {
    if (!result.pairing || !result.conflictPenalty) return all;
    all[result.pairing] ??= {};
    all[result.pairing][result.conflictPenalty] = (all[result.pairing][result.conflictPenalty] ?? 0) + 1;
    return all;
  }, {});
  const conflict_outcomes = results.reduce<Record<string, number>>((all, { conflictChoice }) => {
    if (conflictChoice) all[conflictChoice] = (all[conflictChoice] ?? 0) + 1;
    return all;
  }, {});
  const count = <T extends string>(values: T[]) => values.reduce<Partial<Record<T, number>>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {});
  const paired = results.filter(({ pairing }) => pairing);
  const runs_by_pairing = count(paired.map(({ pairing }) => pairing!));
  const pairingRates = Object.fromEntries(Object.keys(runs_by_pairing).map((pairing) => {
    const group = paired.filter((result) => result.pairing === pairing);
    return [pairing, group.filter(({ won }) => won).length / group.length];
  }));
  const matrixGods = ["zeus", "poseidon", "athena", "ares", "artemis"];
  const win_rate_matrix = Object.fromEntries(matrixGods.map((left) => [left, Object.fromEntries(matrixGods.map((right) => {
    if (left === right) return [right, null];
    const key = Object.keys(pairingRates).find((pairing) => pairing.split("+").includes(left) && pairing.split("+").includes(right));
    return [right, key ? pairingRates[key] : null];
  }))]));
  const rateValues = Object.values(pairingRates) as number[];
  const rateMean = rateValues.length ? rateValues.reduce((sum, value) => sum + value, 0) / rateValues.length : 0;
  const pairing_win_stddev = rateValues.length ? Math.sqrt(rateValues.reduce((sum, value) => sum + (value - rateMean) ** 2, 0) / rateValues.length) : 0;
  /**
   * 척도에 불변인 짝. 승률이 내려가면 조합별 승률이 0에 눌려 표준편차가 기계적으로 작아지는데,
   * 모든 셀에 상수를 곱하는 순수 압축은 이 값을 바꾸지 못한다 — 둘이 같이 줄어야 모양이 바뀐 것이다
   */
  const pairing_win_cv = rateMean ? pairing_win_stddev / rateMean : 0;
  const cardIds = [...new Set(paired.flatMap(({ cardsPlayed }) => cardsPlayed))];
  /** 장당 사용 횟수. `card_win_delta`는 쓰인 카드만 재므로 **안 쓰이는 카드**는 여기서만 보인다 */
  const card_play_count = count(paired.flatMap(({ cardsPlayed }) => cardsPlayed));
  const card_win_delta = Object.fromEntries(cardIds.map((cardId) => {
    const deltas = Object.entries(pairingRates).flatMap(([pairing, baseline]) => {
      const used = paired.filter((result) => result.pairing === pairing && result.cardsPlayed.includes(cardId));
      return used.length ? [used.filter(({ won }) => won).length / used.length - baseline] : [];
    });
    return [cardId, deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0];
  }));
  const encounterKeys = [...new Set(results.flatMap(({ encounterOutcomes }) => encounterOutcomes.map(({ key }) => key)))].sort();
  const encounter_clear_rate = Object.fromEntries(encounterKeys.map((key) => {
    const tries = results.flatMap(({ encounterOutcomes }) => encounterOutcomes.filter((outcome) => outcome.key === key));
    return [key, tries.filter(({ cleared }) => cleared).length / tries.length];
  }));
  const defeats = results.flatMap(({ defeatContext }) => defeatContext ? [defeatContext] : []);
  /** 패시브별 패배 점유율. 합이 1을 넘는다 — 한 조우에 패시브가 둘까지 겹친다 */
  const defeat_by_passive = Object.fromEntries([...new Set(defeats.flatMap(({ passives }) => passives))].sort()
    .map((passive) => [passive, defeats.filter(({ passives }) => passives.includes(passive)).length / defeats.length]));
  return {
    runs: baseResults.length,
    bot_policy_version: botPolicyVersion,
    global_param_version: globalParamVersion,
    wins,
    winRate: baseResults.length ? wins / baseResults.length : 0,
    averageTurns: baseResults.length ? baseResults.reduce((sum, { turns }) => sum + turns, 0) / baseResults.length : 0,
    scenario_runs: results.length - baseResults.length,
    favor_curve: results[0]?.favorCurve ?? [],
    devotion_ratio: ratio("devotion"),
    anger_ratio: ratio("anger"),
    wrath_ratio: ratio("wrath"),
    // 스프레드로 넘기면 16000런(≈20만 점)에서 콜스택이 터진다
    favor_floor: Object.fromEntries(gods.map((god) => [god, points.reduce((low, point) => Math.min(low, point[god] ?? 100), 100)])),
    conflict_outcomes,
    conflict_penalty_dist,
    substituted_actions: results.reduce((sum, { substituted }) => sum + (substituted ?? 0), 0),
    /** `요구 id:단` → 고른 것 중 지킨 비율. 0에 붙으면 지킬 수 없는 단, 1에 붙으면 공짜 단이다 */
    demand_kept_rate: Object.fromEntries(Object.entries(results.reduce<Record<string, [number, number]>>((all, { demandOutcomes }) => {
      for (const [id, [accepted, kept]] of Object.entries(demandOutcomes)) {
        all[id] = [(all[id]?.[0] ?? 0) + accepted, (all[id]?.[1] ?? 0) + kept];
      }
      return all;
    }, {})).map(([id, [accepted, kept]]) => [id, accepted ? kept / accepted : 0])),
    /**
     * 세 답이 실제로 갈리는가. `actions`를 그대로 센다 — 별도 관측을 만들면 두 번째 진실이 된다.
     * 하나로 쏠리면 선택지가 아니라 장식이고, 그게 P-29의 판정이다
     */
    demand_choices: count(results.flatMap(({ actions }) => actions.flatMap((action) => (action.type === "demand" ? [action.choice] : [])))),
    hp_curve: results[0]?.hpCurve ?? [],
    /** 고른 칸의 종류. 넷이 다 0이 아니어야 갈래가 장식이 아니다 */
    path_choices: count(results.flatMap(({ pathChoices }) => pathChoices.map((choice) => choice.split(":")[1]))),
    /** 고른 갈래 번호. 한 갈래로 쏠리면 격자가 일렬과 다를 게 없다 */
    lane_choices: count(results.flatMap(({ pathChoices }) => pathChoices.map((choice) => choice.split(":")[0]))),
    rest_choices: count(results.flatMap(({ restChoices }) => restChoices)),
    region_clear_rate: Object.fromEntries(["underworld", "surface"].map((region) => [region, results.length ? results.filter(({ regionsCleared }) => regionsCleared.includes(region)).length / results.length : 0])),
    low_rest_clear_rate: results.length ? results.filter(({ won, restCount }) => won && restCount <= 1).length / results.length : 0,
    grace_earned: results.reduce<Record<string, number>>((all, { grace }) => {
      for (const [god, value] of Object.entries(grace)) all[god] = (all[god] ?? 0) + value;
      return all;
    }, {}),
    grace_milestones: Object.fromEntries([2, 4, 6].map((milestone) => [milestone, results.length ? results.filter(({ grace }) => Object.values(grace).some((value) => value >= milestone)).length / results.length : 0])),
    enemy_count_dist: count(results.flatMap(({ enemyCounts }) => enemyCounts.map(String))),
    encounter_clear_rate,
    defeat_by_passive,
    target_spread: count(results.flatMap(({ targetSpread }) => targetSpread)),
    block_efficiency: results.reduce((sum, { blockAbsorbed }) => sum + blockAbsorbed, 0) / (results.reduce((sum, { blockBuilt }) => sum + blockBuilt, 0) || 1),
    fusion_rate: results.length ? results.filter(({ fused }) => fused).length / results.length : 0,
    runs_by_pairing,
    /** 조합 → 승률. `win_rate_matrix`가 같은 값을 신×신으로 다시 깐 것이다 — 게이트가 읽는 쪽은 이것 */
    win_rate_by_pairing: pairingRates,
    win_rate_matrix,
    pairing_win_stddev,
    pairing_win_cv,
    card_win_delta,
    card_play_count,
  };
}

export function renderReport(report: ReturnType<typeof summarize>): string {
  return [
    `runs=${report.runs} wins=${report.wins} win_rate=${report.winRate.toFixed(3)} avg_turns=${report.averageTurns.toFixed(2)} bot_policy_version=${report.bot_policy_version} global_param_version=${report.global_param_version}`,
    `favor_curve=${JSON.stringify(report.favor_curve)} favor_floor=${JSON.stringify(report.favor_floor)}`,
    `devotion_ratio=${report.devotion_ratio.toFixed(3)} anger_ratio=${report.anger_ratio.toFixed(3)} wrath_ratio=${report.wrath_ratio.toFixed(3)}`,
    `conflict_outcomes=${JSON.stringify(report.conflict_outcomes)} conflict_penalty_dist=${JSON.stringify(report.conflict_penalty_dist)}`,
    `demand_kept_rate=${JSON.stringify(report.demand_kept_rate)} substituted_actions=${report.substituted_actions}`,
    `demand_choices=${JSON.stringify(report.demand_choices)}`,
    `hp_curve=${JSON.stringify(report.hp_curve)} path_choices=${JSON.stringify(report.path_choices)} lane_choices=${JSON.stringify(report.lane_choices)} rest_choices=${JSON.stringify(report.rest_choices)}`,
    `region_clear_rate=${JSON.stringify(report.region_clear_rate)} low_rest_clear_rate=${report.low_rest_clear_rate.toFixed(3)}`,
    `scenario_runs=${report.scenario_runs} grace_earned=${JSON.stringify(report.grace_earned)} grace_milestones=${JSON.stringify(report.grace_milestones)}`,
    `enemy_count_dist=${JSON.stringify(report.enemy_count_dist)} target_spread=${JSON.stringify(report.target_spread)} block_efficiency=${report.block_efficiency.toFixed(3)}`,
    `encounter_clear_rate=${JSON.stringify(report.encounter_clear_rate)} defeat_by_passive=${JSON.stringify(report.defeat_by_passive)}`,
    `fusion_rate=${report.fusion_rate.toFixed(3)}`,
    `runs_by_pairing=${JSON.stringify(report.runs_by_pairing)} pairing_win_stddev=${report.pairing_win_stddev.toFixed(3)} pairing_win_cv=${report.pairing_win_cv.toFixed(3)}`,
    `win_rate_matrix=${JSON.stringify(report.win_rate_matrix)} card_win_delta=${JSON.stringify(report.card_win_delta)}`,
    `card_play_count=${JSON.stringify(report.card_play_count)}`,
  ].join("\n");
}

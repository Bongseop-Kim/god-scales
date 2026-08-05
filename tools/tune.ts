import { setEpsilon } from "../sim/bots/rule.ts";
import { simulateStratified } from "../sim/engine.ts";
import { summarize } from "../sim/report.ts";

/** 조합당 시드 수. `simulateStratified`가 `seed = floor(index/10)+1`이라 이 수가 곧 고정된 시드 목록(1~300)이다 */
export const seedsPerPairing = 300;
/** 테스트가 잠그는 하한. 잡는 것은 0에 붙은 셀뿐이다 — 6회차 실측 최저가 0.061이었다 */
export const winFloor = 0.05;
/** 릴리스 목표. 테스트에는 넣지 않는다 — 지금 네 셀이 미달이라 넣으면 결국 이 값을 깎게 된다. DEPLOY.md에서만 판정한다 */
export const releaseFloor = 0.25;
/** 300런에서 두 승률 차의 95% 노이즈가 ±0.07이다. 그 위 */
export const noiseBand = 0.1;
/**
 * 강한 봇 승률이 절반이 되는 지점(30.7% → 15.4%, 3,000런). 한 번 정하고 만지지 않는다 —
 * 목적이 회차 간 비교라 값 자체엔 의미가 없다. 콘텐츠가 크게 바뀌어 다시 재야 하면 `--epsilon 0.3`으로
 * 몇 값을 찍어 절반이 되는 곳을 찾고 이 상수를 옮긴다. 0.15는 너무 약해 여섯 조합이 전부 ⚠로 떴다
 */
export const epsilon = 0.45;

export function simulate(epsilonValue = 0) {
  setEpsilon(epsilonValue);
  try {
    return summarize(simulateStratified(seedsPerPairing * 10));
  } finally {
    setEpsilon(0);
  }
}

export function compare(base: Record<string, number>, noisy: Record<string, number>) {
  return Object.keys(base).map((pairing) => {
    const diff = noisy[pairing] - base[pairing];
    return {
      pairing,
      base: base[pairing],
      noisy: noisy[pairing],
      diff,
      below: base[pairing] < winFloor,
      // 결정이 승률로 바뀌지 않는 조합 = 누가 눌러도 같은 결과. 승률이 2·noiseBand 미만인 셀은
      // 절대차가 구조적으로 그보다 작아질 수 없어 판정에서 뺀다 — 그 셀은 하한이 본다
      flat: base[pairing] >= noiseBand * 2 && Math.abs(diff) <= noiseBand,
    };
  });
}

if (process.argv[1]?.endsWith("tune.ts")) {
  const flagIndex = process.argv.indexOf("--epsilon");
  const noiseLevel = flagIndex < 0 ? epsilon : Number(process.argv[flagIndex + 1]);
  if (!(noiseLevel > 0 && noiseLevel <= 1)) throw new Error("--epsilon must be in (0, 1]");
  const base = simulate();
  const noisy = simulate(noiseLevel);
  const rows = compare(base.win_rate_by_pairing, noisy.win_rate_by_pairing);
  const percent = (value: number) => `${(value * 100).toFixed(1)}`;
  console.log(`| 조합 | 승률(ε=0) | 승률(ε=${noiseLevel}) | 차이 |`);
  console.log("|---|---:|---:|---:|");
  for (const row of rows) {
    const mark = row.below ? " ⛔" : row.flat ? " ⚠" : "";
    console.log(`| ${row.pairing}${mark} | ${percent(row.base)}% | ${percent(row.noisy)}% | ${percent(row.diff)}%p |`);
  }
  const below = rows.filter(({ below: miss }) => miss);
  const flat = rows.filter(({ flat: isFlat }) => isFlat);
  console.log(`\n하한 ${winFloor}: ${below.length ? `⛔ 미달 — ${below.map(({ pairing }) => pairing).join(", ")}. 이 조합만 손댄다` : "통과 — 이번 회차 수치 조정 없음"}`);
  console.log(`릴리스 목표 ${releaseFloor}: 미달 ${rows.filter(({ base: rate }) => rate < releaseFloor).length}/${rows.length} (테스트 게이트 아님)`);
  console.log(`⚠ 평평한 조합(|차이| ≤ ${noiseBand}): ${flat.length ? `${flat.map(({ pairing }) => pairing).join(", ")} — 보고만` : "없음"}`);
  console.log(`참고(게이트 아님): pairing_win_stddev=${base.pairing_win_stddev.toFixed(3)} pairing_win_cv=${base.pairing_win_cv.toFixed(3)} 승률=${percent(base.winRate)}%`);
}

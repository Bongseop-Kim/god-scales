/**
 * 하데스의 듀오 전제 그대로 — 두 신의 은혜를 **이미 받았어야** 열린다. 문턱을 넘는 게 아니라
 * 쌓이면 열린다.
 *
 * 옛 게이트는 두 신 호의 ≥70 **그리고** 사용 ≥2였고 합성률 0.045였다(스무 런에 한 번). 호의는
 * 조우마다 −3으로 새므로(`favorDecayPerEncounter`) 경성 문턱과 상성이 나쁘다.
 *
 * 읽는 것은 **획득 수**(`state.grace`)지 지금 슬롯에 걸린 은혜가 아니다. 슬롯은 교체되므로 그쪽으로
 * 재면 한 번 열린 합성이 다시 닫힌다 — 「은혜 보유 수는 새지 않는다」가 이 게이트의 전제다
 */
export function canFuse(grace: Record<string, number>, pair: readonly [string, string]): boolean {
  return pair.every((god) => (grace[god] ?? 0) >= 1);
}

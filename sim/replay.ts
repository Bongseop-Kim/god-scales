import { readFileSync } from "node:fs";
import { deckOk, favorPool, gods, type PatronPair } from "./engine.ts";

/** 휴식처의 3택. `"upgrade"`는 P-44가 더한 자리고 옛 로그에는 없다 — 없으면 그냥 안 나올 뿐이다 */
export type RestChoice = "heal" | "remove" | "upgrade";

export type ReplayAction =
  /** `"1:elite"` — 갈래와 종류. P-27 이전의 `"combat"`은 어느 갈래였는지 정보를 안 갖는다 */
  | { type: "path"; choice: string }
  | { type: "card"; choice: string }
  | { type: "target"; choice: string }
  | { type: "rest"; choice: RestChoice }
  | { type: "rest_card"; choice: string }
  | { type: "grace"; choice: string }
  /** `"tier1"`(수락) · `"tier2"`(시련) · `"reject"`. `"accept"` 별칭은 남기지 않았다 — R-27이 옛 로그를 아카이브했다 */
  | { type: "demand"; choice: "tier1" | "tier2" | "reject" }
  /** `"obey"`(따른다) · `"refuse"`(내 손으로 선다). 옛 로그에는 없다 — 없으면 봇이 대신 답한다 */
  | { type: "oracle"; choice: "obey" | "refuse" }
  /** `choice: ""`는 건너뛰기다. 기록하지 않으면 재생 때 봇이 대신 한 장 집는다 */
  | { type: "reward"; choice: string };
/**
 * `patrons`·`deck`·`split`은 선택 필드다 — 없으면 `run`의 기본값(제우스+아테나 · 규칙 덱 · 50:50)으로
 * 재생된다. 옛 로그가 그대로 산다. **모드 필드를 따로 두지 않는다**: 자유 모드인지는 `deck`의 유무가
 * 이미 말하고, 둘을 다 두면 어긋날 수 있는 두 번째 진실이 된다
 */
export type ReplayFile = { seed: number; actions: ReplayAction[]; replay_mode: "action_log"; patrons?: PatronPair; deck?: string[]; split?: number };

export function readReplay(path: string): ReplayFile {
  const replay = JSON.parse(readFileSync(path, "utf8")) as ReplayFile;
  if (!Number.isInteger(replay.seed) || replay.replay_mode !== "action_log" || !Array.isArray(replay.actions)) {
    throw new Error(`Invalid replay: ${path}`);
  }
  // 조합이 어긋나면 시작 덱이 달라 카드 id가 손에 없다 — 봇이 대신 답하며 조용히 다른 게임이 된다
  const { patrons } = replay;
  if (patrons !== undefined && !(Array.isArray(patrons) && patrons.length === 2 && patrons[0] !== patrons[1] && patrons.every((god) => gods.includes(god)))) {
    throw new Error(`Invalid patrons: ${path}`);
  }
  // 열 장 · 존재하는 id · tier1 patron 카드 안 — 셋을 `deckOk` 하나가 잰다(`sim/engine.ts`)
  const { deck } = replay;
  if (deck !== undefined && (!Array.isArray(deck) || !deckOk(deck))) throw new Error(`Invalid deck: ${path}`);
  // 배분은 한 숫자다 — 범위 밖이면 `shiftFavor`가 조용히 잘라 파일과 다른 런이 된다
  const { split } = replay;
  if (split !== undefined && !(Number.isInteger(split) && split >= 0 && split <= favorPool)) throw new Error(`Invalid split: ${path}`);
  return replay;
}

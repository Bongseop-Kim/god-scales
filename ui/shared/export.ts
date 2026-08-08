import { favorPool, ruleDeck, type PatronPair } from "../../sim/engine.ts";
import type { ReplayAction, ReplayFile } from "../../sim/replay.ts";

/**
 * `deck`은 **규칙 덱과 다를 때만** 실린다 — 편집기를 열었다 닫은 런이 고정 모드로 남고 e2e 기준선이
 * 안 움직인다. 순서까지 본다: `createCombat`이 덱 배열을 그대로 섞으므로 자리를 바꾼 덱은 다른 런이다.
 * `split`도 같은 규칙이다 — 슬라이더를 안 민 런은 필드가 없고, 그것이 곧 「50:50으로 재생된다」다
 */
export function replayPayload(seed: number, actions: ReplayAction[], patrons: PatronPair, deck?: string[], split = favorPool / 2): ReplayFile {
  const free = deck && deck.join() !== ruleDeck(patrons).join();
  return { seed, actions, replay_mode: "action_log", patrons, ...(free ? { deck } : {}), ...(split === favorPool / 2 ? {} : { split }) };
}

export function downloadReplay(seed: number, actions: ReplayAction[], patrons: PatronPair, deck?: string[], split?: number): void {
  const blob = new Blob([`${JSON.stringify(replayPayload(seed, actions, patrons, deck, split), null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `god-scales-run-${seed}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

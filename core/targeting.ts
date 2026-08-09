import type { ActorState, CombatState, EnemyState } from "./state.ts";

export type Target = "self" | "enemy" | "all_enemies";

/** 사거리를 안 적는 비공격 카드의 기본값 */
export const fullReach = "0123";
export const reachSlots = (reach = fullReach): number[] => [...reach].map(Number);
/** 규칙은 정규식 하나다 — 모양을 표로 두면 열째 모양이 코드 수정이 된다 */
export const reachOk = (reach: string): boolean =>
  /^[0-3]{1,4}$/.test(reach) && [...reach].every((digit, index, all) => index === 0 || digit > all[index - 1]);

/**
 * 사거리 안에 살아 있는 적. **칸은 배열 인덱스다** — `EnemyState`에 `slot`을 넣으면 두 번째 진실이 된다.
 * 죽은 적은 자리를 비운 채 배열에 남으므로 아무도 밀려 오지 않는다(StS와 같다).
 *
 * 두 칸을 차지한 적은 **같은 참조가 두 칸에** 있다 — 여기 한 곳에서 동일성으로 지우면 `resolveTargets`·
 * `resolveChainTargets`·`canReachTarget`이 전부 따라온다. 안 지우면 `all_enemies`가 보스를 두 번 때린다.
 * 지운 뒤에도 사거리 `0`·`1`이 둘 다 그 적에 닿는다: 걸러 낸 **뒤에** 지우기 때문이다
 */
export function livingInReach(combat: CombatState, reach?: string): EnemyState[] {
  const slots = reachSlots(reach);
  return [...new Set(combat.enemies.filter((enemy, slot) => enemy.hp > 0 && slots.includes(slot)))];
}

/**
 * 사거리 밖만 남은 `target: enemy` 카드는 낼 수 없다 — 손패에서 비활성으로 뜬다.
 * `all_enemies`는 그대로 낼 수 있고 아무도 안 맞는다(적이 다 죽은 것과 같은 자리다)
 */
export const canReachTarget = (combat: CombatState, card: { target: Target; reach?: string }): boolean =>
  card.target !== "enemy" || livingInReach(combat, card.reach).length > 0;

export function resolveTargets(
  combat: CombatState,
  target: Target,
  enemyId?: string,
  reach?: string,
): ActorState[] {
  if (target === "self") return [combat.player];
  const reachable = livingInReach(combat, reach);
  if (target === "all_enemies") return reachable;

  const enemy = reachable.find((candidate) => candidate.id === enemyId);
  if (!enemy) throw new Error(`Unknown living enemy in reach: ${enemyId ?? "none"}`);
  return [enemy];
}

/** 연쇄도 같은 필터를 탄다 — 안 걸면 `0` 카드가 사거리를 넘어 전체 공격이 된다 */
export function resolveChainTargets(combat: CombatState, primaryId: string, reach?: string): EnemyState[] {
  return livingInReach(combat, reach).filter((enemy) => enemy.id !== primaryId);
}

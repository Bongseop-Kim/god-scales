import { addToken, dealDamage, type Effect } from "./rules.ts";
import type { ActorState, GameState } from "./state.ts";

export const favorInitial = 50;
export const favorDecayPerEncounter = -3;
export const favorNeglectPenalty = -2;
/** 요구 보상은 이제 단마다 다르다 — `data/demands.json`의 `tiers[].reward`가 든다 (P-29) */
export const rivalDemandPenalty = -18;
export const nonRivalDemandPenalty = -9;
export const favorBoundaries = { devotion: 70, calm: 30, anger: 10, wrath: 0 } as const;
/**
 * v3: shock·soaked·mark·frenzy 구현, deflect/displace/bulwark 재가격, 헌신·진노 오라 연결, baseCardBalance 0
 * v4: 헌신 개입 다섯(토큰 부여 → 행동), 포세이돈 진노 displace → soaked, 요구를 모든 조우 앞에
 * v5: 은혜가 슬롯에 붙는다(P-28) — 마일스톤 강화·비용 감소와 `grace >= 4` 오라 +1을 지웠고,
 *     합성 게이트가 호의 문턱에서 은혜 보유로 바뀌었다
 * v6: 요구가 2단이다(P-29) — `demandReward` 정액이 단별 보상으로 갔고, 시련 단은 선불 대가
 *     (상대 신 호의 −18 즉시 · 최대 체력 −8을 조우 2회)를 받고 은혜 하나를 준다
 */
export const globalParamVersion = "v6";

export type FavorStage = keyof typeof favorBoundaries;
export type FavorUses = Record<string, number>;
/**
 * 개입 하나. 카드와 같은 `Effect`에 대상만 붙는다 — 카드는 `target`을 카드가 갖고 신은 효과마다 갖는다.
 * 신은 언제·어디에 개입할지 스스로 정하므로 대상이 효과의 일부다
 */
export type StageEffect = Effect & { target: "self" | "enemy" | "all_enemies" };
export type FavorGod = { id: string; stage_effects: { devotion?: { on_encounter_start: StageEffect[] }; wrath?: { on_encounter_start: StageEffect[] } } };

export function favorStage(value: number): FavorStage {
  if (value >= favorBoundaries.devotion) return "devotion";
  if (value >= favorBoundaries.calm) return "calm";
  if (value >= favorBoundaries.anger) return "anger";
  return "wrath";
}

export function shiftFavor(favor: Record<string, number>, god: string, amount: number): number {
  favor[god] = Math.max(0, Math.min(100, (favor[god] ?? favorInitial) + amount));
  return favor[god];
}

/**
 * 조우당 신별 상한. **5를 그대로 둔다.** 5는 감쇠 −3보다 커서 호의가 조우마다 +2씩 구조적으로 오르고,
 * 그래서 P-30이 이 상한을 다이얼로 후보에 올렸다 — 4000런으로 재고 되돌렸다:
 *
 * - 3 (표류 0): 진노 0.005 → 0.012인데 **합성률 0.047 → 0.003.** `canFuse`는 조합 둘 다 70을 요구하고,
 *   요구는 patron만 올리고 상대를 내린다 — 표류가 0이면 둘이 같이 70에 서는 일이 사라진다
 * - 2 (표류 −1): 진노 0.047(목표 0.05도 못 넘는다)에 아테나 은총 1096 → 174
 *
 * 둘 다 목표를 못 넘으면서 다른 콘텐츠를 끈다. 진노 도달은 P-29의 시련 대가로 연다 — reviews/30-intervention.md
 */
export function recordCardFavor(favor: Record<string, number>, god: string, uses: FavorUses): void {
  uses[god] = (uses[god] ?? 0) + 1;
  if (uses[god] <= 5) shiftFavor(favor, god, 1);
}

export function finishCombatFavor(favor: Record<string, number>, patrons: string[], uses: FavorUses): void {
  for (const god of patrons) shiftFavor(favor, god, favorDecayPerEncounter + ((uses[god] ?? 0) === 0 ? favorNeglectPenalty : 0));
}

export function finishRestFavor(favor: Record<string, number>, patrons: string[]): void {
  for (const god of patrons) shiftFavor(favor, god, favorDecayPerEncounter);
}

function targets(state: GameState, target: StageEffect["target"]): ActorState[] {
  if (target === "self") return [state.combat.player];
  const enemies = state.combat.enemies.filter(({ hp }) => hp > 0);
  return target === "enemy" ? enemies.slice(0, 1) : enemies;
}

/**
 * 호의가 문턱을 넘으면 신이 묻지 않고 판을 흔든다. **개입 자체에는 페널티가 없다** — 좋을지 나쁠지는
 * 앞에 선 적이 정한다(P-25의 `curl`·`angry`·`rally`·`ward`). 그래서 개입은 전부 `dealDamage`·`addToken`을
 * 타야 하고, 그 두 함수 안에 충돌이 다 들어 있다.
 *
 * ponytail: `executeCard`를 타지 않는다 — 그쪽은 이로운 토큰을 카드 target과 무관하게 플레이어로
 * 돌리므로(`selfTokens`) 아테나 진노의 「적이 보루 5를 얻는다」가 뒤집힌다. 어휘는 같고 대상만 신이 갖는다
 */
export function applyFavorStageEffects(state: GameState, definitions: FavorGod[]): void {
  for (const god of definitions) {
    const stage = favorStage(state.favor[god.id] ?? favorInitial);
    if (stage !== "devotion" && stage !== "wrath") continue;
    for (const effect of god.stage_effects[stage]?.on_encounter_start ?? []) {
      for (const actor of targets(state, effect.target)) {
        if (effect.op === "damage") dealDamage(state.combat.player, actor, effect.value ?? 0);
        else if (effect.op === "block") actor.block += effect.value ?? 0;
        else if (effect.op === "heal") actor.hp = Math.min(actor.maxHp, actor.hp + (effect.value ?? 0));
        else if (effect.op === "apply_token" && effect.token) addToken(actor, effect.token, effect.stacks ?? 1);
        // 조용히 아무 일도 안 하는 개입이 §0의 부채였다 — 게이트가 먼저 잡지만 여기서도 안 삼킨다
        else throw new Error(`${god.id} ${stage}: unsupported stage effect ${effect.op}`);
      }
    }
  }
}

/**
 * 헌신인 신마다 은혜 하나. 「정확히 하나일 때만」이었던 옛 규칙은 **은혜가 어느 신의 것인지 정할 수
 * 없다**는 이유였는데, 은혜가 신별 콘텐츠가 된 뒤로는 그 이유가 없다 — 둘 다 헌신이면 둘 다 제안한다.
 *
 * 그 규칙이 합성을 구조적으로 막고 있었다: 한 신이 먼저 70을 넘으면 그 신만 은혜를 받고, 둘이 같이
 * 헌신인 순간에는 아무도 못 받는다. 「두 신의 은혜를 갖고 있어야」가 전제인 합성률이 그래서 0.000이었다
 */
export function awardGrace(favor: Record<string, number>, grace: Record<string, number>, patrons: string[]): string[] {
  const devoted = patrons.filter((god) => favorStage(favor[god] ?? favorInitial) === "devotion");
  for (const god of devoted) grace[god] = Math.min(6, (grace[god] ?? 0) + 1);
  return devoted;
}

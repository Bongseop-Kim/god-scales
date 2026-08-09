import { actors, queueEnemy } from "./combat.ts";
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
 * v7: 판에 칸이 넷 생겼다(P-35) — 카드 25장에 사거리가 붙고 `guard` 재지정이 사거리를 못 넘으며,
 *     진노가 신을 적으로 큐에 넣어 빈 칸에 세운다
 * v8: 밀려남이 자리를 옮긴다(P-36) — 밀린 적이 뒤로 한 칸 가며 앞뒤가 맞바뀌고, `slot(target)`
 *     조건 카드 다섯이 자리를 읽는다. 턴 스킵과 값 표(`displace = 6`)는 그대로다
 * v9: 값에 계단이 셋 생겼다(P-39) — 밴드가 tier1 `[4, 8)` · tier2 `[8, 10)` · tier3(융합) `[10, 13]`으로
 *     안 겹치게 갈리고, tier2 카드 15장이 지상부터만 보상에 뜬다(정예·보스는 세 자리 전부).
 *     융합 여덟 장이 tier3 하한 위로 올라갔다. 배포된 tier1 124장은 한 줄도 안 바뀌었다
 */
export const globalParamVersion = "v9";

export type FavorStage = keyof typeof favorBoundaries;
export type FavorUses = Record<string, number>;
/**
 * 개입 하나. 카드와 같은 `Effect`에 대상만 붙는다 — 카드는 `target`을 카드가 갖고 신은 효과마다 갖는다.
 * 신은 언제·어디에 개입할지 스스로 정하므로 대상이 효과의 일부다
 */
export type StageEffect = Effect & { target: "self" | "enemy" | "all_enemies" };
/**
 * 개입이 터지는 자리 둘. `on_turn_start`는 **그 턴 안에 사라지는 것만** 든다 — 지속 토큰과 적 방어는
 * 조우 내내 쌓여서(적 방어는 리셋이 없다, `core/combat.ts:73`은 플레이어만 지운다) 밸런스가 아니라
 * 고장이 된다. 게이트가 `tools/validate.ts`에서 그것을 잠근다
 */
export type StageHook = "on_encounter_start" | "on_turn_start";
/**
 * 매 턴 훅이 터지는 주기. **1이 아니다** — 조우가 6.65턴이라 매 턴 개입은 한 조우에 여섯 번이고,
 * 4000런 대신 1200런 층화로 재보면 그 값이 밴드를 깬다:
 *
 * | 주기 | 승률(층화) | 저휴식 클리어(기본 조합 500런) |
 * |---|---:|---:|
 * | 개입 없음(P-30) | 0.502 | 0.146 |
 * | 매 턴 | 0.582 | **0.356** (상한 0.24) |
 * | 두 턴 | 0.572 | **0.272** |
 * | **세 턴** | **0.531** | **0.188** |
 *
 * 정수 아래로는 못 내려간다 — 「1 피해」가 이미 조우당 6이다. 그래서 크기가 아니라 **주기**를 다이얼로
 * 썼다. 나머지 2는 조우 시작 개입과 겹치지 않게 한 칸 민 것이다(2·5·8턴)
 */
export const interventionEveryTurns = 3;
export const intervenesOnTurn = (turn: number): boolean => turn % interventionEveryTurns === 2;
/** 지금 턴의 개입은 이미 적용됐다. 다음 2·5·8…턴까지 남은 턴만 파생한다 */
export function turnsUntilIntervention(turn: number): number {
  for (let wait = 1; wait <= interventionEveryTurns; wait += 1) if (intervenesOnTurn(turn + wait)) return wait;
  return interventionEveryTurns;
}
export type FavorGod = { id: string; stage_effects: Partial<Record<FavorStage, Partial<Record<StageHook, StageEffect[]>>>> };
/**
 * 신이 말하는 자리 열(`data/gods.json`의 `lines`). 셋은 단계로 갈리고 일곱은 한 벌이다 —
 * 갈리는 셋이 조우마다 뜨는 것들이고(조우 시작 · 개입 턴 · 단계 경계) 나머지는 사건이라 그 자리에
 * 단계가 없다. 게이트(`tools/validate.ts`)와 화면(`ui/header.tsx`)이 같은 이 한 벌을 읽는다
 */
export const lineTriggers = ["encounter", "intervene", "cross", "demand_offer", "demand_kept", "demand_broken", "tear", "join", "reconcile", "fuse"] as const;
export type LineTrigger = (typeof lineTriggers)[number];
export const stagedLineTriggers: readonly LineTrigger[] = ["encounter", "intervene", "cross"];
/**
 * 진노가 부르는 신 적의 id. 스프라이트도 같은 이름을 쓴다(`art/sprites/enemy_god_zeus.webp`) —
 * 게이트가 `join`마다 이 id의 `tier: "god"` 적이 배포됐는지 본다
 */
export const godEnemyId = (god: string): string => `enemy_god_${god}`;
/**
 * 진노한 신을 판 위에서 꺾으면 호의가 여기로 돌아온다 — 다음 조우에는 다시 서지 않는다.
 * **반복을 끊는 상태를 따로 만들지 않는다**: 반복의 원인이 호의였으므로 호의를 올리는 것이 곧
 * 반복을 끊는 것이다. 플래그를 두면 replay·화면·게이트가 그 플래그를 다 알아야 한다.
 *
 * 50이 아니라 평온의 **하한**이다 — 감쇠 −3이 열 조우 만에 다시 진노로 데려간다. 화해는 휴전이다
 */
export const wrathReconcileFavor: number = favorBoundaries.calm;

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
 * - 3 (표류 0): 진노 0.005 → 0.012였지만 은혜 도달이 크게 줄었다.
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
  // 두 칸짜리는 같은 참조가 두 칸에 있다 — 안 지우면 진노의 `all_enemies`가 보스를 두 번 친다
  const enemies = actors(state.combat).filter(({ hp }) => hp > 0);
  return target === "enemy" ? enemies.slice(0, 1) : enemies;
}

/**
 * 호의가 문턱을 넘으면 신이 묻지 않고 판을 흔든다. **개입 자체에는 페널티가 없다** — 좋을지 나쁠지는
 * 앞에 선 적이 정한다(P-25의 `curl`·`angry`·`rally`·`ward`). 그래서 개입은 전부 `dealDamage`·`addToken`을
 * 타야 하고, 그 두 함수 안에 충돌이 다 들어 있다.
 *
 * ponytail: `executeCard`를 타지 않는다 — 그쪽은 이로운 토큰을 카드 target과 무관하게 플레이어로
 * 돌리므로(`selfTokens`) 아테나 진노의 「적이 보루 5를 얻는다」가 뒤집힌다. 어휘는 같고 대상만 신이 갖는다
 *
 * 단계를 코드가 다시 세지 않는다 — **데이터가 있는 단계가 곧 개입하는 단계**다. 평온이 조우의 6할인데
 * 거기 데이터가 없어 신이 침묵하던 것이 P-34가 고친 자리다
 */
export function applyFavorStageEffects(state: GameState, definitions: FavorGod[], hook: StageHook = "on_encounter_start"): void {
  for (const god of definitions) {
    const stage = favorStage(state.favor[god.id] ?? favorInitial);
    for (const effect of god.stage_effects[stage]?.[hook] ?? []) {
      /**
       * 합류는 **큐에만** 넣는다 — 즉시 세우면 4칸이 꽉 찬 조우에서 갈 곳이 없고, 카드 실행 중
       * 배열이 바뀌는 자리를 하나 더 만든다. 입장은 `admitPending` 하나가 한다
       */
      if (effect.op === "join") {
        if (!effect.god) throw new Error(`${god.id} ${stage} ${hook}: join requires god`);
        queueEnemy(state.combat, godEnemyId(effect.god));
        continue;
      }
      for (const actor of targets(state, effect.target)) {
        if (effect.op === "damage") dealDamage(state.combat.player, actor, effect.value ?? 0);
        else if (effect.op === "block") actor.block += effect.value ?? 0;
        else if (effect.op === "heal") actor.hp = Math.min(actor.maxHp, actor.hp + (effect.value ?? 0));
        else if (effect.op === "apply_token" && effect.token) addToken(actor, effect.token, effect.stacks ?? 1);
        // 조용히 아무 일도 안 하는 개입이 §0의 부채였다 — 게이트가 먼저 잡지만 여기서도 안 삼킨다
        else throw new Error(`${god.id} ${stage} ${hook}: unsupported stage effect ${effect.op}`);
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

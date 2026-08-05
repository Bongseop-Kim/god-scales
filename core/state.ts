import type { Card } from "./rules.ts";

export type CardId = string;

/**
 * 토큰 어휘. 스택 방식은 소모하는 자리(`consumeToken`·`tickBleed`·`dealDamage`)가 정하고 여기서는
 * 세지 않는다 — 분류를 표로 두면 읽는 코드가 없어 주석과 다를 게 없다. `mark`만 비스택(켜짐/꺼짐),
 * `thorns`만 소모되지 않는다. 만료형(턴 수)은 아직 없다
 */
export const tokenNames = ["shock", "displace", "soaked", "bulwark", "deflect", "bleed", "frenzy", "mark", "crit", "thorns"] as const;

export type TokenName = (typeof tokenNames)[number];
export type Tokens = Partial<Record<TokenName, number>>;

/** 파워가 걸리는 훅 넷. 전부 P-25가 이미 여는 자리다 */
export const triggers = ["turn_start", "turn_end", "on_play", "on_unblocked"] as const;
export type Trigger = (typeof triggers)[number];
/**
 * 등록된 파워. 전투 내내 남아 트리거마다 카드의 효과를 **다시** 실행한다. 계획의 `{cardId, effects}`
 * 대신 카드를 그대로 든다 — 발동이 `executeCard`를 타므로 카드가 곧 인자다
 */
export type Power = { trigger: Trigger; card: Card };

/**
 * 적 패시브 여덟. 값은 전부 스택 수라 배열이 아니라 표다 — 훅마다 `find(p => p.kind === …)`를 도는
 * 대신 `actor.passives?.shell` 한 번이면 된다. 플레이어에게도 붙을 수 있는 자리다(P-31 `thorns`)
 */
export const passiveNames = ["guard", "shell", "ward", "curl", "angry", "rally", "ramp", "spite"] as const;
export type PassiveName = (typeof passiveNames)[number];
export type Passives = Partial<Record<PassiveName, number>>;

export type ActorState = {
  id: string;
  hp: number;
  maxHp: number;
  block: number;
  tokens: Tokens;
  passives?: Passives;
  /** `shell`이 읽는다. 「한 턴」은 플레이어 턴 + 적 턴 한 바퀴 — `endTurn` 맨 끝에서 0으로 돌아간다 */
  lostThisTurn?: number;
  /** `curl`이 읽는다. 이번 전투에서 실제로 체력을 잃은 적이 있는가 — 반사는 세지 않는다 */
  hit?: boolean;
};

/** `defeated`는 `rally`가 죽음을 두 번 세지 않게 한다 */
export type EnemyState = ActorState & { patternIndex: number; defeated?: boolean };
export type CombatOutcome = "ongoing" | "victory" | "defeat" | "timeout";

export type CombatState = {
  turn: number;
  energy: number;
  outcome: CombatOutcome;
  timeout: boolean;
  player: ActorState;
  drawPile: CardId[];
  hand: CardId[];
  discardPile: CardId[];
  enemies: EnemyState[];
  /** 낸 순서대로. 같은 파워를 두 번 내면 두 개 등록된다(StS와 같다) — 덱에 두 장 넣는 것 자체가 비용이다 */
  powers: Power[];
};

export type GameState = {
  seed: number;
  combat: CombatState;
  favor: Record<string, number>;
  grace: Record<string, number>;
  map: { node: number; completed: string[] };
};

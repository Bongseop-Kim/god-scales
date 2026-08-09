import type { MapGrid } from "./map.ts";
import type { Card } from "./rules.ts";

export type CardId = string;

/**
 * 토큰 어휘. 스택 방식은 소모하는 자리(`consumeToken`·`tickBleed`·`dealDamage`)가 정하고 여기서는
 * 세지 않는다 — 분류를 표로 두면 읽는 코드가 없어 주석과 다를 게 없다. `mark`만 비스택(켜짐/꺼짐),
 * `thorns`·`might`만 소모되지 않는다. 만료형(턴 수)은 아직 없다.
 *
 * `drain`·`fog`는 **플레이어에게만 뜻이 있다** — 소모 자리가 `startTurn`의 에너지·뽑기 한 줄뿐이라
 * 적에게 붙으면 `displace`가 플레이어에게 붙은 것과 같은 죽은 토큰이다. `selfTokens`에 없으므로
 * 카드가 이것을 적는 순간 적에게 날아간다: 신 어휘(`data/gods.json`)에 넣지 않는 것이 그 잠금이다
 */
export const tokenNames = ["shock", "displace", "soaked", "bulwark", "deflect", "bleed", "frenzy", "mark", "crit", "thorns", "might", "drain", "fog"] as const;

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
  /** 길이가 곧 칸 수(`MAX_SLOTS`)다 — 인덱스가 칸이고 빈 칸은 시체와 같은 꼴로 서 있다 */
  enemies: EnemyState[];
  /**
   * 입장을 기다리는 적 정의 id. 진노가 넣고 `admitPending`이 빈 칸에 세운다 — 조우 안에서만 산다.
   * 4칸이 꽉 차면 큐는 그대로 기다린다(신이 문 앞에서 기다리는 자리다)
   */
  pending: string[];
  /** 낸 순서대로. 같은 파워를 두 번 내면 두 개 등록된다(StS와 같다) — 덱에 두 장 넣는 것 자체가 비용이다 */
  powers: Power[];
  /**
   * 이번 턴에 낸 것. `startTurn`이 0으로 돌리고 `playCard`가 센다 — 조건 셋이 이것만 읽는다.
   * **내는 카드가 자기를 센다**: `cards_played_in_turn >= 3`은 「이번 턴 세 번째 카드부터」다.
   * 파워 발동은 세지 않는다 — 카드를 낸 것이 아니다
   */
  turnPlays: { cards_played: number; attacks: number; energy_spent: number };
  /**
   * 이번 카드가 재지정한 피해. `playCard` 진입에서 비운다 — 한 번의 클릭이 만드는 사실이다.
   * `turnPlays`와 같은 꼴의 **파생 기록**이라 규칙이 이것을 읽고 분기하지 않는다: 화면이 「누가 대신
   * 맞았나」를 체력바 비교로 추측하면 연쇄·전체 카드가 섞인 프레임에서 그 추측이 틀린다
   */
  guarded: { by: string; from: string }[];
};

export type GameState = {
  seed: number;
  combat: CombatState;
  favor: Record<string, number>;
  /** 그 신에게서 받은 은혜 수. 다음 은혜의 tier만 정한다. 고른 은혜는 카드 id가 든다. */
  grace: Record<string, number>;
  /** `lane`은 런 시작에 `bossLane`이다 — 그래야 1층에서 세 갈래가 다 열린다 */
  map: { depth: number; lane: number; grid: MapGrid; completed: string[] };
};

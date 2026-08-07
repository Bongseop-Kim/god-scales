import { admitPending, createCombat, endTurn, playCard, startTurn, updateOutcome, type EnemyAction, type EnemyDefinition, type Lineup } from "../core/combat.ts";
import { createRng } from "../core/rng.ts";
import cardDataJson from "../data/cards.json" with { type: "json" };
import demandDataJson from "../data/demands.json" with { type: "json" };
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import godDataJson from "../data/gods.json" with { type: "json" };
import graceDataJson from "../data/graces.json" with { type: "json" };
import mapDataJson from "../data/map.json" with { type: "json" };
import { applyFavorStageEffects, awardGrace, favorInitial, favorStage, finishCombatFavor, intervenesOnTurn, recordCardFavor, type FavorGod, type FavorUses } from "../core/favor.ts";
import { demandPenalty, demandSatisfied, payDemandCost, resolveDemand, tierEnemies, type Demand, type DemandOffer, type DemandTier } from "../core/demands.ts";
import { graceOffer, graceSlots, graceTier, takeGrace, type Grace, type GraceSlot } from "../core/grace.ts";
import { advanceMap, bossLane, enemyDamageScale, enterNode, floorsPerRegion, generateMap, laneCount, mapDepth, mapSlot, reachableLanes, takeRest, type MapGrid, type MapNodeType } from "../core/map.ts";
import { canFuse } from "../core/fusion.ts";
import { cardEffects, cardLevel, MAX_UPGRADE, upgradeId, upgraded, type Card, type GodId } from "../core/rules.ts";
import { canReachTarget, livingInReach } from "../core/targeting.ts";
import type { GameState, Passives, Tokens, Trigger } from "../core/state.ts";
import { chooseCard, chooseDemandAnswer, chooseGrace, choosePath, chooseRest, chooseRestCard, chooseReward, chooseTarget } from "./bots/rule.ts";
import { renderPlay } from "./log.ts";
import type { RunResult } from "./report.ts";
import type { ReplayAction, RestChoice } from "./replay.ts";

export const gods: GodId[] = ["zeus", "poseidon", "athena", "ares", "artemis"];
export type PatronPair = readonly [GodId, GodId];
export type Scenario = "grace_4" | "grace_6" | "fused_deck";
// 난이도는 enemyDamageScale 하나로 잡는다. 카드 수치에 상수를 더하던 baseCardBalance는 승률을
// 못 움직이면서 화면에 5.9/6.9를 띄웠고, 0이 된 뒤로는 카드를 통째로 복사하는 값이 됐다
type CardData = Omit<Card, "patronPair"> & { patron_pair?: [Card["patron"], Card["patron"]] };
const cards = (cardDataJson as CardData[]).map(({ patron_pair, ...card }) => (patron_pair ? { ...card, patronPair: patron_pair } : card) as Card);
const fusionCards = cards.filter(({ patronPair }) => patronPair);
/** 헌신·진노 오라의 정의. 조합 밖의 신은 호의가 없어 calm으로 읽히므로 다섯을 다 넘겨도 자기 필터가 된다 */
const godData = godDataJson as FavorGod[];
/** 은혜 45줄 = 설계 열다섯 × tier 셋. 슬롯 적용은 `cardEffects` 하나뿐이다 */
const graces = graceDataJson as Grace[];
/**
 * `--aura-matrix`가 **헌신 개입만** 끄고 같은 시드를 다시 돌린다 — 기여는 두 열의 차이로만 잰다.
 * 진노는 끄지 않는다: 그쪽은 처벌이고 도달률로 따로 잰다
 */
let devotionOff = false;
export function setDevotionAura(off: boolean): void { devotionOff = off; }
// 헌신 열만 뺀다 — 평온·분노도 같이 끄면 두 열의 차이가 「헌신 기여」가 아니라 「개입 전체 기여」가 된다
const auraGods = (): FavorGod[] => devotionOff
  ? godData.map(({ stage_effects: { devotion, ...rest }, ...god }) => ({ ...god, stage_effects: rest }))
  : godData;
/** 화면에는 단별 `text`만 나간다 — `condition` DSL은 사람이 읽을 문장이 아니다 */
const demandData = demandDataJson as Demand[];
/** 층별 편성과 텍스트. 지역 하나가 아니라 `(층, 종류)`가 조우를 고르는 단위가 됐다 */
type MapSlotData = { id: string; region: string; floor: number; text: string; groups: Partial<Record<"combat" | "elite", string[]>> };
const mapData = mapDataJson as MapSlotData[];
const mapSlots = new Map(mapData.map((slot) => [`${slot.region}:${slot.floor}`, slot]));
/** 정예를 놓을 수 있는 층 = 정예 편성이 있는 층. 층을 코드로 열면 없는 편성을 찾게 된다 */
export const eliteSlots = new Set(mapData.filter(({ groups }) => groups.elite?.length).map(({ region, floor }) => `${region}:${floor}`));

/**
 * 시작 덱의 3장은 신별 태그가 정한다 — 공격 1 · 방어 1 · 유틸 1, 같은 비용이면 데이터 순서.
 * **tier1만 본다**: 시작 덱은 보상 계단의 아래칸이고 편집기가 고를 수 있는 것과 같은 목록이어야 한다
 * (`startableCards`). P-44가 cost 0짜리 tier2를 넣자 그 카드들이 「가장 싼 공격」이 되어 시작 덱을
 * 통째로 가져갔다 — 정렬 기준이 비용 하나뿐인 것이 그때까지 안 드러난 자리다
 */
function starterCards(god: GodId): [string, string, string] {
  const own = cards.filter((card) => card.patron === god && (card.tier ?? 1) === 1).sort((a, b) => a.cost - b.cost);
  const picked: string[] = [];
  for (const tag of ["attack", "defend", "utility"] as const) {
    const card = own.find(({ id, tags }) => tags.includes(tag) && !picked.includes(id));
    if (!card) throw new Error(`${god}: starter deck needs a ${tag} card`);
    picked.push(card.id);
  }
  return picked as [string, string, string];
}
export const godDecks = Object.fromEntries(gods.map((god) => [god, starterCards(god)])) as Record<GodId, [string, string, string]>;

/** 시작 덱은 언제나 열 장이다. 다이얼로 열면 자유 모드가 「모드」가 아니라 난이도 슬라이더가 된다 */
export const deckSize = 10;
/**
 * 규칙이 뽑는 시작 덱 — `patrons[0]`에게 2·2·1, `[1]`에게 3·1·1. **자유 모드의 기본값이기도 하다**:
 * 편집기가 이 열 장으로 차 있고, 손대지 않은 덱은 반출에 안 적힌다(`ui/export.ts`)
 */
export const ruleDeck = (patrons: PatronPair): string[] => [
  godDecks[patrons[0]][0], godDecks[patrons[0]][0], godDecks[patrons[0]][1], godDecks[patrons[0]][1], godDecks[patrons[0]][2],
  godDecks[patrons[1]][0], godDecks[patrons[1]][0], godDecks[patrons[1]][0], godDecks[patrons[1]][1], godDecks[patrons[1]][2],
];

/** 보상은 조합에 속한 신 둘의 카드에서만 3장 나온다 — 신 선택이 보상에 반영되는 지점 */
export const skipReward = "";
/**
 * 3택1 중 tier2가 차지하는 자리 수. **깊이가 아니라 갈래가 정한다** — P-39는 「지상 일반 전투도 한
 * 자리」로 설계했고 3000런 층화가 그것을 되돌렸다:
 *
 * | 판 | 승률 | 최저 셀 | 변동계수 |
 * |---|---:|---:|---:|
 * | 기준선(P-38) | 0.399 | 0.147 | 0.489 |
 * | 융합 8장만 상향 | 0.401 | 0.140 | 0.486 |
 * | **+ 정예·보스 세 자리** | **0.424** | **0.140** | **0.444** |
 * | + 지상 일반 한 자리(설계) | 0.369 | 0.083 | 0.527 |
 * | + 지상 일반 세 자리 | 0.391 | 0.090 | 0.454 |
 *
 * 지상 일반 전투에 tier2를 주면 자리 수가 1이든 3이든 최저 셀이 0.14 → 0.08~0.09으로 내려간다.
 * **아레스 셀 넷이 전부 내려간다** — `expectedValue`가 값싼 자기 강화(`frenzy`·`self_damage`·`thorns`)를
 * 실제 세기보다 높게 재고 `chooseReward`가 같은 표로 고르므로, 3장뿐인 tier2 풀이 덱에 반복해 쌓인다.
 * 정예·보스는 그 자리가 런당 1~3회뿐이라 같은 카드가 세 장 나오는 일이 없다.
 *
 * `depth`를 안 읽으므로 지역이 늘어도 안 바뀐다 — 저승이 tier1뿐인 것은 이제 **저승에 정예 편성이 없다**는
 * 사실이 든다(`data/map.json`). 저승에 정예를 놓으면 이 규칙이 아니라 그 편성이 등급을 옮긴다
 */
const tier2Slots = (path: MapNodeType): number => (path === "elite" || path === "boss" ? 3 : 0);
/** 테스트가 부른다 — 자리 수보다 후보가 적을 때 던지는 가드는 배포 데이터로는 못 만드는 상황이다 */
export function rewardOffer(random: () => number, patrons: PatronPair, tier2 = 0): string[] {
  const offer: string[] = [];
  /**
   * **tier2를 먼저 뽑는다.** 같은 `createRng(seed * 1000 + nodeSeed)` 스트림을 쓰므로 소비 순서가 곧
   * 결과다 — 나중에 뽑으면 tier2 자리가 0인 저승에서도 tier1 카드열이 흔들려 옛 replay가 깨진다
   */
  for (const [tier, wanted] of [[2, tier2], [1, 3]] as const) {
    const candidates = cards.filter((card) => card.patron && patrons.includes(card.patron) && (card.tier ?? 1) === tier);
    // 후보가 자리 수보다 적으면 아래 루프가 영원히 돈다 — 멈추는 대신 왜 멈췄는지 말한다
    if (candidates.length < wanted - offer.length) throw new Error(`${patrons.join("+")}: reward offer needs ${wanted - offer.length} tier${tier} cards`);
    while (offer.length < wanted) {
      const { id } = candidates[Math.floor(random() * candidates.length)];
      if (!offer.includes(id)) offer.push(id);
    }
  }
  return offer;
}

type EnemyData = {
  id: string;
  /** 신 적에게는 없다 — 조우가 아니라 진노가 부른다 */
  region?: string;
  tier: "normal" | "boss" | "god";
  role: string;
  hp: number;
  passives?: Passives;
  pattern: { op: string; value?: number; token?: import("../core/state.ts").TokenName; stacks?: number; repeat?: number; target?: EnemyAction["target"] }[];
  /** `with`의 순서가 칸 1·2·3이다. 빈 칸은 못 적는다 — 편성은 언제나 칸 0부터 붙여 채운다 */
  groups?: { id: string; with: string[] }[];
};
const enemyData = enemyDataJson as EnemyData[];

function enemyDefinition(enemy: EnemyData): EnemyDefinition {
  return {
    id: enemy.id,
    hp: enemy.hp,
    passives: enemy.passives,
    // 난이도는 피해에만 걸린다 — 회복·토큰까지 긁으면 enemyDamageScale이 조우 밴드와 다른 눈금이 된다
    pattern: enemy.pattern.map((effect) => ({
      damage: effect.op === "damage" ? Math.ceil((effect.value ?? 0) * (effect.repeat ?? 1) * enemyDamageScale) : undefined,
      block: effect.op === "block" ? effect.value : undefined,
      heal: effect.op === "heal" ? effect.value : undefined,
      token: effect.op === "apply_token" ? effect.token : undefined,
      // 호의는 난이도 눈금을 안 탄다 — 판 밖의 값이라 `enemyDamageScale`이 손댈 자리가 아니다
      favor: effect.op === "favor_shift" ? effect.value : undefined,
      stacks: effect.stacks,
      target: effect.target,
    })),
  };
}

/**
 * 조우는 지역이 아니라 `(층, 종류)`가 고른다 — `data/map.json`이 그 자리의 편성 후보를 갖는다.
 * 시드에 갈래가 섞여 있어야 같은 층의 두 `combat` 갈래가 다른 적을 뱉는다
 */
function encounter(seed: number, region: string, floor: number, type: MapNodeType): Lineup {
  if (type === "boss") {
    const bosses = enemyData.filter((enemy) => enemy.region === region && enemy.tier === "boss");
    const boss = bosses[seed % bosses.length];
    if (!boss) throw new Error(`${region}: no boss`);
    // 보스는 칸 0·1 두 칸을 차지한다 — 사거리 `1`·`01`·`12` 카드가 보스전에서 처음으로 산다.
    // 칸 2·3은 빈다: 부하를 붙이면 보스 층 편성 데이터·밴드·재측정이 통째로 딸려온다
    return [{ ...enemyDefinition(boss), size: 2 }];
  }
  const candidates = mapSlots.get(`${region}:${floor}`)?.groups[type === "elite" ? "elite" : "combat"] ?? [];
  if (!candidates.length) throw new Error(`${region} ${floor}: no ${type} group`);
  const groupId = candidates[seed % candidates.length];
  const root = enemyData.find((enemy) => enemy.groups?.some(({ id }) => id === groupId));
  const group = root?.groups?.find(({ id }) => id === groupId);
  if (!root || !group) throw new Error(`Unknown encounter group: ${groupId}`);
  // 편성의 순서가 곧 배치다 — 뿌리가 칸 0이고 `with`가 칸 1·2·3이다. 없는 id를 빈 칸으로 바꾸지
  // 않는다: 그러면 오타 하나가 한 명 모자란 편성이 되어 조용히 선다
  return [enemyDefinition(root), ...group.with.map((id) => {
    const member = enemyData.find((enemy) => enemy.id === id);
    if (!member) throw new Error(`Unknown encounter member: ${id} (${groupId})`);
    return enemyDefinition(member);
  })];
}

/**
 * 진노가 부르는 신 적. **판이 아니라 사전에** 미리 들어간다 — `endTurn`의 `definitions.get`이 던지지 않고
 * `startTurn` 시그니처도 안 바뀐다. 편성에는 안 섞인다: `encounter`가 `tier`로 걸러 뽑는다
 */
const godEnemies = enemyData.filter(({ tier }) => tier === "god").map(enemyDefinition);

/**
 * `slot`은 칸 번호(0이 앞)다 — 화면이 이것으로 빈 칸을 그린다. 위치만으로는 스크린 리더가 앞뒤를 모른다.
 * `span`은 차지한 칸 수(보스만 2)이고, 그 적은 **한 번만** 나간다 — 두 번 내보내면 같은 보스가 두 판에 뜬다
 */
type EnemyView = { id: string; slot: number; span: number; hp: number; maxHp: number; block: number; tokens: Tokens; passives: Passives; intent?: EnemyAction };
/** UI가 data/cards.json을 따로 읽으면 두 번째 진실이 된다 — 카드는 엔진이 준 것만 그린다 */
export type CardView = { id: string; name: string; cost: number; target: Card["target"]; effects: Card["effects"]; reach?: string };
const cardView = ({ id, name, cost, target, effects, reach }: Card): CardView => ({ id, name, cost, target, effects, ...(reach ? { reach } : {}) });
/**
 * 자유 덱 편집기가 고를 수 있는 카드 124장을 신별로. **tier1 patron 카드뿐이다** — tier2 15장은
 * 보상이 주는 계단이고, 융합 10장은 `patron`이 없어 같은 줄에서 빠진다(은혜 둘을 모아 여는 자리다).
 * `rewardOffer`와 같은 필터를 쓴다: 등급 규칙이 두 벌이면 화면과 게이트가 갈린다.
 * 신별로 갈라 두는 이유는 편집기가 다섯 탭이어서다 — 화면이 다시 `patron`으로 나누면 두 번째 진실이다
 */
export const startableCards = Object.fromEntries(gods.map((god) =>
  [god, cards.filter((card) => card.patron === god && (card.tier ?? 1) === 1).map(cardView)])) as Record<GodId, CardView[]>;
const startableIds = new Set(Object.values(startableCards).flatMap((list) => list.map(({ id }) => id)));
/**
 * 자유 덱 하나가 성립하는가. **파일은 신뢰 경계다** — 여기서 안 걸리면 `cardMap.get(id)!`가 엔진
 * 안에서 터진다. 조용히 규칙 덱으로 되돌리지 않는다: 그러면 「재생했는데 다른 게임」이 된다
 */
export const deckOk = (deck: readonly string[]): boolean =>
  deck.length === deckSize && deck.every((id) => startableIds.has(id));

/**
 * `+N` 붙은 id를 만나면 그 자리에서 만들어 사전에 넣는다 — **카드를 조회하는 자리가 전부 그대로 돈다.**
 * 덱을 건드린 뒤 한 번씩 부르므로 사전에는 실제로 덱에 든 등급만 선다(`deck_count`가 유령을 세지 않는다)
 */
function syncUpgrades(cardMap: Map<string, Card>, deck: readonly string[]): void {
  for (const id of deck) {
    if (cardMap.has(id)) continue;
    const { base, level } = cardLevel(id);
    const card = cardMap.get(base);
    if (!card) throw new Error(`Unknown upgraded card: ${id}`);
    cardMap.set(id, upgraded(card, level));
  }
}

/**
 * 지금 덱에서 강화할 수 있는 카드. 상한 `+2`이고 **융합 열 장은 대상 밖이다** — 여는 데 이미 은혜
 * 둘이 들었고 거기에 ×1.4를 얹으면 「융합을 뽑았는가」가 런의 결말이 된다(P-44 §6). 조건이 카드가
 * 아니라 소유 규칙이므로 데이터에 필드를 더하지 않는다
 */
const upgradable = (deck: readonly string[], cardMap: ReadonlyMap<string, Card>): string[] =>
  [...new Set(deck)].filter((id) => {
    const { base, level } = cardLevel(id);
    return level < MAX_UPGRADE && !cardMap.get(base)?.patronPair;
  });
const runView = (state: GameState, patrons: PatronPair): RunView => {
  const { region, floor } = mapSlot(state.map.depth);
  return { depth: state.map.depth, lane: state.map.lane, region, floor, hp: state.combat.player.hp, maxHp: state.combat.player.maxHp, patrons, grid: state.map.grid, favor: { ...state.favor }, grace: { ...state.grace } };
};
/**
 * 모든 관측이 공유한다. `patrons`는 런 내내 고정이고, 화면 머리글이 조합 이름을 여기서 읽는다.
 * 위치도 격자도 여기 있다 — UI가 시드로 `generateMap`을 다시 풀면 같은 사실에 두 경로가 생긴다.
 * `favor`·`grace`는 조합 둘의 것만 든다 — 나머지 셋은 아무것도 움직이지 않으므로 칸이 아예 없다(R-26)
 */
export type RunView = {
  depth: number; lane: number; region: string; floor: number; hp: number; maxHp: number; patrons: PatronPair; grid: MapGrid;
  favor: Record<string, number>;
  grace: Record<string, number>;
};
/** 등록된 파워 하나. 카드를 그대로 실어 화면이 효과문을 손패와 같은 `effectText`로 그린다 */
type PowerView = { trigger: Trigger; card: CardView };
export type CombatObservation = RunView & {
  turn: number;
  block: number;
  tokens: Tokens;
  energy: number;
  draw: number;
  hand: CardView[];
  /** 전투 내내 매 턴 일한다 — 화면에 없으면 몇 장 냈는지 플레이어가 세고 있어야 한다 */
  powers: PowerView[];
  enemies: EnemyView[];
  /** 지난 yield 이후 깎인 체력. `id`는 적 id 또는 `player` */
  hits: { id: string; amount: number }[];
  /** hits가 새로 생길 때마다 오른다 — UI가 같은 팝을 두 번 재생하지 않게 하는 열쇠 */
  hitSeq: number;
  /** target phase에서 지금 내려는 카드 */
  card?: string;
};
/** `text`는 그 층의 문장이다 — 지도 화면이 지금 어디 서 있는지 한 줄로 읽는다 */
type MapObservation = RunView & { deck: CardView[]; text: string };
type RewardObservation = RunView & { deck: number; cards: CardView[] };
/**
 * 은혜 후보 하나. `cards`는 지금 덱에 있는 그 슬롯의 카드 수 — 은혜가 몇 장에 붙는지가 결정의 근거다.
 * `replaces`는 그 슬롯이 이미 든 은혜의 문장으로, **무엇을 밀어내는지** 화면에 서야 한다
 */
type GraceOffer = { id: string; slot: GraceSlot; tier: number; text: string; effects: Card["effects"]; cards: number; replaces?: string };
type GraceObservation = RunView & { god: string; tier: number; offer: GraceOffer[] };
/**
 * 요구 하나. `tiers`에는 **지금 제안되는 단만** 들어간다 — 5층과 적이 모자란 조우에서 시련이 빠지므로
 * 화면이 두 칸짜리가 된다. `penalty`는 지켰을 때 상대 신이 잃는 관계 벌금이고 선불 대가와 별개다
 */
type DemandObservation = RunView & { patron: string; other: string; penalty: number; tiers: DemandOffer[] };
/** 봇이 고를 값(`bot`)을 같이 내보낸다 — 답을 채우지 않으면 이것이 쓰이고, 정책은 엔진 안에만 남는다 */
export type CombatDecision = { phase: "card" | "target"; options: string[]; bot: string; observation: CombatObservation };
export type MapDecision = { phase: "path" | "rest" | "rest_card"; options: string[]; bot: string; observation: MapObservation };
export type RewardDecision = { phase: "reward"; options: string[]; bot: string; observation: RewardObservation };
export type GraceDecision = { phase: "grace"; options: string[]; bot: string; observation: GraceObservation };
export type DemandDecision = { phase: "demand"; options: string[]; bot: string; observation: DemandObservation };
export type Decision = CombatDecision | MapDecision | RewardDecision | GraceDecision | DemandDecision;
export const endTurnAction = "end_turn";

type EncounterResult = {
  turns: number;
  blockBuilt: number;
  blockAbsorbed: number;
  targetSpread: ("single" | "multi")[];
  cardsPlayed: string[];
  /** `demandSatisfied`가 읽는 이름들이다 — 요구 조건 DSL의 좌변과 같은 키여야 한다 */
  facts: Record<string, number>;
};

function* playEncounter(state: GameState, seed: number, deck: string[], cardMap: Map<string, Card>, lineup: Lineup, log: string[], patrons: PatronPair, noise: () => number): Generator<Decision, EncounterResult, string> {
  /** **판과 사전을 갈라 둔다** — 사전에는 신 적 다섯이 미리 들어 있고 판에는 편성만 선다 */
  const enemyMap = new Map([...lineup, ...godEnemies].map((enemy) => [enemy.id, enemy]));
  const random = createRng(seed);
  // 최대 체력도 이어 받는다 — 시련의 선불 대가가 여기 걸려 있고, `createCombat`은 매번 MAX_HP로 돌린다
  const { hp, maxHp } = state.combat.player;
  state.combat = createCombat(seed, deck, lineup);
  state.combat.player.hp = hp;
  state.combat.player.maxHp = maxHp;
  /**
   * **후원 둘만** 개입한다. 전에는 단계 필터가 대신 걸러줬다 — 조합 밖의 신은 호의가 없어 평온으로
   * 읽히고 평온에는 데이터가 없었다. 평온이 개입하는 지금(P-34) 그 필터는 사라졌으므로 여기서 거른다
   */
  const patronGods = () => auraGods().filter(({ id }) => (patrons as readonly string[]).includes(id));
  applyFavorStageEffects(state, patronGods());
  // 진노가 큐에 넣은 신을 여기서 세운다 — 4칸이 꽉 차 있으면 문 앞에서 기다리고 `endTurn`이 다시 본다
  admitPending(state.combat, enemyMap);
  const uses: FavorUses = {};
  let blockBuilt = 0;
  let blockAbsorbed = 0;
  const targetSpread: ("single" | "multi")[] = [];
  const cardsPlayed: string[] = [];
  let hits: CombatObservation["hits"] = [];
  let hitSeq = 0;
  const facts = { hit_targets_in_turn: 0, damage_taken: 0, tokens_applied: 0, tokens_applied_in_turn: 0 };
  let turnTargets = new Set<string>();
  let turnTokens = 0;
  const healthBar = () => [["player", state.combat.player.hp] as const, ...state.combat.enemies.map(({ id, hp: enemyHp }) => [id, enemyHp] as const)];
  /** `byCard`일 때만 맞은 적을 센다 — 출혈 도트는 이번 턴에 "친" 것이 아니다 */
  const recordHits = (before: (readonly [string, number])[], byCard = false) => {
    const now = new Map(healthBar());
    const damage = before.flatMap(([id, hp]) => {
      const lost = hp - (now.get(id) ?? hp);
      return lost > 0 ? [{ id, amount: Math.round(lost * 10) / 10 }] : [];
    });
    for (const { id, amount } of damage) {
      if (id === "player") facts.damage_taken += amount;
      else if (byCard) turnTargets.add(id);
    }
    if (!damage.length) return;
    hits = damage;
    hitSeq += 1;
  };
  const observation = (): CombatObservation => ({
    ...runView(state, patrons),
    turn: state.combat.turn,
    block: state.combat.player.block,
    tokens: { ...state.combat.player.tokens },
    energy: state.combat.energy,
    draw: state.combat.drawPile.length,
    // 손패는 **은혜가 붙은 뒤의** 효과를 싣는다 — 캡션이 카드 원문만 적으면 공격 슬롯 은혜가 붙은
    // 카드가 화면에서 거짓말을 하고, 그러면 화면만 보고 턴을 계산할 수 없다. 낼 때 도는 목록과 같다
    hand: state.combat.hand.map((id) => {
      const card = cardMap.get(id)!;
      return { ...cardView(card), effects: cardEffects(state, card) };
    }),
    powers: state.combat.powers.map(({ trigger, card }) => ({ trigger, card: cardView(card) })),
    // 칸을 실어 보낸다 — 살아 있는 적만 보내면 화면이 남은 적이 앞뒤 어디였는지 그릴 수 없다
    enemies: state.combat.enemies.flatMap((enemy, slot) => {
      // 별칭은 **동일성으로** 한 번만 내보낸다 — 안 지우면 같은 보스가 두 판에 겹쳐 뜬다
      if (enemy.hp <= 0 || state.combat.enemies.indexOf(enemy) !== slot) return [];
      const pattern = enemyMap.get(enemy.id)!.pattern;
      // 패시브는 정의가 아니라 **상태**에서 온다 — `ward`·`guard`는 소모되므로 정의를 읽으면 화면이 안 움직인다
      const passives = Object.fromEntries(Object.entries(enemy.passives ?? {}).filter(([, stacks]) => stacks > 0));
      const span = state.combat.enemies.lastIndexOf(enemy) - slot + 1;
      return [{ id: enemy.id, slot, span, hp: enemy.hp, maxHp: enemy.maxHp, block: enemy.block, tokens: { ...enemy.tokens }, passives, intent: pattern[enemy.patternIndex % pattern.length] }];
    }),
    hits,
    hitSeq,
  });

  while (state.combat.outcome === "ongoing") {
    startTurn(state, random);
    // 전투 중 개입. `startTurn` **뒤**여야 방어 리셋(`core/combat.ts:73`) 뒤에 아테나의 방어가 살아남고,
    // 파워·뽑은 손패와 같은 화면에 선다. 죽인 적은 `updateOutcome`이 거둔다 — 안 거두면 `rally`가 안 돌고
    // 마지막 적을 개입이 죽인 조우가 시간 초과까지 간다
    if (state.combat.outcome === "ongoing" && intervenesOnTurn(state.combat.turn)) {
      const beforeAura = healthBar();
      const blockBefore = state.combat.player.block;
      applyFavorStageEffects(state, patronGods(), "on_turn_start");
      // 개입이 준 방어도 쌓은 방어다 — 안 세면 `block_efficiency`의 분모가 빠져 효율이 1을 넘는다
      blockBuilt += state.combat.player.block - blockBefore;
      recordHits(beforeAura);
      updateOutcome(state.combat);
    }
    while (state.combat.outcome === "ongoing") {
      // 사거리 밖만 남은 `target: enemy` 카드는 여기서 빠진다 — 손패에서 비활성으로 뜬다
      const affordable = state.combat.hand.filter((id) => {
        const card = cardMap.get(id);
        return card !== undefined && card.cost <= state.combat.energy && canReachTarget(state.combat, card);
      });
      const cardId = yield {
        phase: "card",
        options: [...affordable, endTurnAction],
        bot: chooseCard(state.combat, cardMap, enemyMap, state.favor, noise) ?? endTurnAction,
        observation: observation(),
      };
      if (cardId === endTurnAction) break;
      const card = cardMap.get(cardId);
      if (!card) throw new Error(`Invalid card action: ${cardId}`);
      cardsPlayed.push(cardId);
      // 닿지 않는 적은 대상 목록에 없다
      const targets = card.target === "enemy" ? livingInReach(state.combat, card.reach).map(({ id }) => id) : [];
      const target = targets.length
        ? yield {
          phase: "target",
          options: targets,
          bot: chooseTarget(card, state.combat, enemyMap, noise)!,
          observation: { card: cardId, ...observation() },
        }
        : undefined;
      // 카드 것 + 그 슬롯 은혜 것을 같이 센다 — 화면에 붙은 토큰을 요구가 세지 않으면 두 번째 진실이다
      const played = cardEffects(state, card);
      // 조건 없는 방어만 센다 — 아래 토큰과 같은 이유다. `when`이 걸린 방어는 붙었는지 여기서 알 수 없고,
      // 세면 `block_efficiency`의 분모가 쌓지 않은 방어까지 든다
      blockBuilt += played.reduce((sum, effect) => sum + (effect.op === "block" && !effect.when ? effect.value ?? 0 : 0), 0);
      targetSpread.push(card.target === "all_enemies" || played.some(({ op }) => op === "chain") ? "multi" : "single");
      const beforeCard = healthBar();
      playCard(state, cardMap, cardId, target);
      recordHits(beforeCard, true);
      // 조건 없는 토큰만 센다 — `when`이 걸린 효과는 붙었는지 여기서 알 수 없으므로 세지 않는다
      const applied = played.reduce((sum, effect) => sum + (effect.op === "apply_token" && !effect.when ? effect.stacks ?? 1 : 0), 0);
      facts.tokens_applied += applied;
      turnTokens += applied;
      if (card.patron) recordCardFavor(state.favor, card.patron, uses);
      log.push(`node=${state.map.depth + 1}:${state.map.lane} ${renderPlay(state.combat, card, target)}`);
    }
    facts.hit_targets_in_turn = Math.max(facts.hit_targets_in_turn, turnTargets.size);
    turnTargets = new Set();
    // 누적 스택은 한 전투에서 열 개가 그냥 오간다 — 축을 "한 턴 안에 붙인 스택"으로 바꾼 자리다
    facts.tokens_applied_in_turn = Math.max(facts.tokens_applied_in_turn, turnTokens);
    turnTokens = 0;
    if (state.combat.outcome === "ongoing") {
      const block = state.combat.player.block;
      const beforeTurn = healthBar();
      endTurn(state, enemyMap);
      recordHits(beforeTurn);
      blockAbsorbed += Math.max(0, block - state.combat.player.block);
    }
  }
  finishCombatFavor(state.favor, [...patrons], uses);
  return { turns: state.combat.turn, blockBuilt, blockAbsorbed, targetSpread, cardsPlayed, facts };
}

/**
 * `startingDeck`이 자유 모드의 전부다 — **엔진에 모드 플래그가 없다.** 안 넘기면 규칙 덱이고,
 * `tune`·`sim`·`heatmap`이 안 넘기므로 그것이 곧 게이트에서의 제외다. `--free` 같은 CLI 옵션을
 * 만들지 않는 이유도 같다: 만드는 순간 누군가 그걸로 게이트를 돌린다
 */
export function* runSteps(seed: number, scenario?: Scenario, patrons: PatronPair = ["zeus", "athena"], startingDeck: string[] = ruleDeck(patrons)): Generator<Decision, RunResult, string> {
  const fusedCard = fusionCards.find(({ patronPair }) => patronPair?.every((god) => patrons.includes(god)));
  if (!fusedCard) throw new Error(`${patrons.join("+")}: no fused card for this pairing`);
  const deck = [...startingDeck, ...(scenario === "fused_deck" ? [fusedCard.id] : [])];
  const cardMap = new Map(cards.map((card) => [card.id, structuredClone(card)]));
  const graced = scenario === "grace_4" ? 4 : scenario === "grace_6" ? 6 : 0;
  const state: GameState = {
    seed,
    combat: createCombat(seed, deck, []),
    favor: { [patrons[0]]: graced ? 70 : 50, [patrons[1]]: 50 },
    grace: { [patrons[0]]: 0, [patrons[1]]: 0 },
    graceSlots: {},
    map: { depth: 0, lane: bossLane, grid: generateMap(seed, eliteSlots), completed: [] },
  };
  const log: string[] = [];
  // ε 동전은 전투·셔플·보상과 겹치지 않는 스트림에서 뽑는다. 겹치면 ε을 켜는 것만으로 적 뽑기까지
  // 흔들려 두 열이 다른 게임이 된다. ε=0이면 아무도 당기지 않으므로 기존 replay는 그대로 재생된다
  const noise = createRng(seed ^ 0x5eed);
  const favorCurve = [{ ...state.favor }];
  const hpCurve = [state.combat.player.hp];
  /** `"1:elite"` 꼴. 갈래와 종류를 같이 들어야 옛 로그가 어느 갈래였는지 못 갖는 것이 드러난다 */
  const pathChoices: string[] = [];
  const restChoices: RestChoice[] = [];
  /**
   * 지킨 요구가 주는 강화. **고르는 자리가 아니다** — 새 결정 phase는 replay·화면·e2e가 통째로
   * 딸려오고, 고르는 자리는 이미 휴식처다. 규칙은 `chooseReward`와 같은 표를 쓴다: 지금 덱에서
   * 기대값이 가장 큰 강화 가능한 카드 한 장
   */
  const grantUpgrade = (count: number): void => {
    for (let given = 0; given < count; given += 1) {
      const raisable = upgradable(deck, cardMap);
      if (!raisable.length) return;
      const best = chooseReward(raisable, cardMap);
      deck[deck.indexOf(best)] = upgradeId(best);
      syncUpgrades(cardMap, deck);
    }
  };
  const regionsCleared: string[] = [];
  let encounters = 0;
  let restCount = 0;
  let turns = 0;
  let blockBuilt = 0;
  let blockAbsorbed = 0;
  const enemyCounts: number[] = [];
  const encounterOutcomes: RunResult["encounterOutcomes"] = [];
  let defeatContext: RunResult["defeatContext"];
  const targetSpread: ("single" | "multi")[] = [];
  const cardsPlayed: string[] = [];
  let fused = scenario === "fused_deck";
  const actions: ReplayAction[] = [];
  /** 요구마다 편든 신 — 약속을 지키면 요구한 신, 아니면 상대다 */
  const demandSides: string[] = [];
  const demandOutcomes: Record<string, [number, number]> = {};
  /**
   * 지금 붙어 있는 시련의 선불 대가. `maxHp`는 `state.combat.player`에 이미 들어가 있고 이 칸은
   * **남은 기간**을 든다 — 조우가 지나면 줄고 0에서 여유를 되돌려 준다(카오스의 저주가 걷히는 자리)
   */
  let trial: { maxHp: number; encounters: number } | undefined;
  const view = () => runView(state, patrons);

  /** 지금 덱의 슬롯별 카드 수. 은혜 값은 이 장수만큼 곱해져 들어가므로 봇도 화면도 이것을 읽는다 */
  const deckSlotCards = (): Record<string, number> => Object.fromEntries(graceSlots
    .map((slot) => [slot, deck.filter((id) => cardMap.get(id)?.tags.includes(slot)).length]));

  /**
   * 은혜 3택1. 옛 판은 「덱에 있는 그 신의 카드 한 장」이었고 그건 결정이 아니라 절차였다 — 지금은
   * 어느 슬롯에 부을지, 넓게 갈지 깊게 갈지가 결정이다. 은혜는 카드가 아니므로 후보는 은혜 id다
   */
  function* grantGrace(god: string): Generator<Decision, void, string> {
    const tier = graceTier(state.grace[god] ?? 0);
    const offer = graceOffer(graces, god, state.graceSlots, tier);
    if (!offer.length) return;
    const options = offer.map(({ id }) => id);
    const slotCards = deckSlotCards();
    const held = state.graceSlots;
    const choice = yield {
      phase: "grace",
      options,
      bot: chooseGrace(offer, held, slotCards) ?? options[0],
      observation: {
        ...view(),
        god,
        tier,
        // `graceOffer`가 슬롯 승계까지 풀어서 준다 — 여기서 tier를 다시 세면 두 번째 진실이다
        offer: offer.map(({ id, slot, tier: level, text, effects }) => ({
          id,
          slot,
          tier: level,
          text,
          effects,
          cards: slotCards[slot] ?? 0,
          replaces: graces.find((grace) => grace.id === held[slot]?.id && grace.tier === held[slot]?.tier)?.text,
        })),
      },
    };
    if (!options.includes(choice)) throw new Error(`Invalid grace action: ${choice}`);
    takeGrace(graces, state.graceSlots, offer.find(({ id }) => id === choice)!);
    actions.push({ type: "grace", choice });
  }

  /**
   * 요구는 전투 **전에** 묻는다. 화면에 "셋을 쳐라"라고 띄웠으면 그 전투에서 정말 셋을 쳤는지로
   * 판정해야 한다 — 고른 단은 약속이고, 보상은 지켰을 때만 들어간다. `tier`가 없으면 거절이다
   */
  type DemandPromise = { demand: Demand; patron: GodId; other: GodId; choice: string; tier?: DemandTier };
  function* askDemand(enemyCount: number, nodeSeed: number, mustAsk = false): Generator<Decision, DemandPromise | undefined, string> {
    /**
     * 요구는 **모든 조우 앞에** 선다. 전에는 `(seed + nodeSeed) % 5 >= 3`으로 60%만 물었다 —
     * 진노는 라이벌 요구 −18로만 닿을 수 있고 조합당 두세 번으로는 문턱을 넘지 못했다.
     * 빈도는 결정의 횟수지 세기가 아니다: 승률은 0.400 → 0.397로 안 움직이고 은총은 같이 올랐다
     */
    /**
     * 첫 신이 은혜를 하나 받은 뒤부터 요구를 두 신에 **번갈아** 건다. 늘 `patrons[0]`만 올리면 상대는
     * 헌신에 닿지 못하고 은혜도 합성도 한 신으로만 간다 — 요구는 patron을 올리고 상대를 내린다.
     * 처음부터 번갈아 걸면 반대로 나빠진다(합성률 0.245 → 0.134): 호의가 갈려 **아무도** 헌신에 못
     * 서고 은총 2 도달이 0.715 → 0.667로 떨어진다. 한 신을 먼저 올려 사다리를 열고 그다음 상대를 올린다.
     * 옛 판은 `artemis`를 이름으로 박아 두고 은혜 6을 기다리는 예외 하나였다
     */
    const seekFusion = (state.grace[patrons[0]] ?? 0) >= 1;
    const demandIndex = seekFusion ? (seed + nodeSeed) % 2 : 0;
    // 적이 둘뿐인 전투에 "셋을 쳐라"를 띄우면 지킬 수 없는 약속이다
    const askable = (god: GodId) => demandData.filter(({ patron, min_enemies }) => patron === god && min_enemies <= enemyCount);
    /**
     * `omen`에서만 상대 신으로 넘긴다. 제우스의 요구는 둘 다 적 둘 이상을 요구하는데 `omen`은 다음
     * 조우의 크기를 모르므로 1로 묻는다 — 넘기지 않으면 제우스가 걸린 `omen` 칸이 조용히 아무 일도
     * 안 한다(omen 방문의 43.7%였다). 칸 하나가 통째로 그 질문이라 물을 것이 없으면 칸이 없다.
     *
     * 전투 칸은 넘기지 않는다: 거기서 안 묻는 것은 「지킬 수 있는 요구가 없다」는 맞는 답이고,
     * 넘기면 조합마다 요구 수가 달라져 원장의 P-28 줄이 다른 규칙판의 숫자가 된다
     */
    const index = !mustAsk || askable(patrons[demandIndex]).length ? demandIndex : 1 - demandIndex;
    const patron = patrons[index];
    const other = patrons[1 - index];
    const asked = askable(patron);
    const demand = asked[(seed + nodeSeed) % asked.length];
    if (!demand) return undefined;
    /**
     * 시련이 서지 않는 자리 셋. 빠지면 화면이 두 칸이 되고 `options`가 그것을 그대로 싣는다.
     *
     * - **이미 시련을 지고 있으면 안 제안한다.** 겹치면 대가가 쌓여 최대 체력이 바닥으로 내려가는데,
     *   그건 결정이 아니라 나선이다. 이 한 줄이 대가를 **기간 있는 것**으로 만든다(카오스도 저주가
     *   붙은 동안에는 그 문이 닫혀 있다) — 그리고 시련 중에는 수락·거절이 실제 선택지가 된다
     * - **5층에는 안 제안한다.** 하데스가 보스 앞에서 저주를 못 걷히게 막는 것과 같은 보호고, 대가가
     *   조우 둘을 사므로 5층을 막으면 6층 보스는 선불 없이 싸운다. 6층 **자체**는 막지 않았다 —
     *   그러면 시련 중 사망이 0.174 → 0.045로 내려가지만 합성률이 0.239 → 0.184로 빠진다(R-29)
     * - 그 단이 요구하는 적이 이 조우에 없으면 지킬 수 없는 약속이다(`omen`은 조우 크기를 모르니 1로 묻는다)
     */
    const offers: DemandOffer[] = demand.tiers.flatMap((tier, index) => {
      if (index > 0 && (trial || mapSlot(state.map.depth).floor === floorsPerRegion - 1 || tierEnemies(tier.condition, demand.min_enemies) > enemyCount)) return [];
      return [{ action: `tier${index + 1}`, text: tier.text, cost: tier.cost, reward: tier.reward }];
    });
    const options = [...offers.map(({ action }) => action), "reject"];
    const choice = yield {
      phase: "demand",
      options,
      bot: chooseDemandAnswer(offers, state.favor, patron, other, state.combat.player.hp, state.combat.player.maxHp),
      observation: { ...view(), patron, other, penalty: demandPenalty(patron, other).amount, tiers: offers },
    };
    if (!options.includes(choice)) throw new Error(`Invalid demand action: ${choice}`);
    // `options`가 셋 중 하나임을 바로 위에서 잰다 — `ui/app.tsx`의 반출도 같은 자리에서 같은 단언을 쓴다
    actions.push({ type: "demand", choice } as ReplayAction);
    const tier = choice === "reject" ? undefined : demand.tiers[Number(choice.slice(4)) - 1];
    if (tier?.cost) {
      // 데이터가 적은 값이 아니라 **실제로 깎인 값**을 든다 — 그래야 기간 만료의 되돌림이 대칭이다
      const roof = state.combat.player.maxHp;
      payDemandCost(state, other, tier.cost);
      // 겹치지 않는다 — 시련 중에는 시련이 안 서므로 카운터는 언제나 하나다
      if (tier.cost.maxHp) trial = { maxHp: roof - state.combat.player.maxHp, encounters: tier.cost.encounters ?? 1 };
    }
    return { demand, patron, other, choice, tier };
  }

  function* offerReward(nodeSeed: number, path: MapNodeType): Generator<Decision, void, string> {
    // 전투/셔플과 겹치지 않는 새 스트림이다. 겹치면 기존 replay 재생이 깨진다
    const offer = rewardOffer(createRng(seed * 1000 + nodeSeed), patrons, tier2Slots(path));
    const picked = yield {
      phase: "reward",
      options: [...offer, skipReward],
      bot: chooseReward(offer, cardMap, noise),
      observation: { ...view(), deck: deck.length, cards: offer.map((id) => cardView(cardMap.get(id)!)) },
    };
    if (picked !== skipReward && !offer.includes(picked)) throw new Error(`Invalid reward action: ${picked}`);
    if (picked) deck.push(picked);
    actions.push({ type: "reward", choice: picked });
  }

  // 시나리오는 은혜를 미리 받은 상태에서 출발한다 — 획득 순서대로 tier가 오르므로 한 개씩 준다
  for (let earned = 1; earned <= graced; earned += 1) {
    state.grace[patrons[0]] = earned;
    yield* grantGrace(patrons[0]);
  }

  /**
   * `omen`에서 걸어 둔 약속. 판정은 다음 조우의 사실이 하므로 **하나만** 든다 — 둘을 걸면 같은
   * 전투 하나로 호의가 두 번 들어오고, 그건 요구가 아니라 수도꼭지다
   */
  let carried: DemandPromise | undefined;

  while (state.map.depth < mapDepth && state.combat.player.hp > 0) {
    const { region, floor } = mapSlot(state.map.depth);
    const row = state.map.grid[state.map.depth];
    const options = reachableLanes(state.map.depth, state.map.lane).map((lane) => `${lane}:${row[lane]}`);
    const mapObservation: MapObservation = { ...view(), deck: deck.map((id) => cardView(cardMap.get(id)!)), text: mapSlots.get(`${region}:${floor}`)!.text };
    // 갈래가 하나뿐인 자리는 보스 층뿐이다 — 물을 것이 없으면 묻지 않는다
    if (options.length > 1) {
      const choice = yield {
        phase: "path",
        options,
        bot: choosePath(options, state.combat.player.hp, state.combat.player.maxHp, state.map.grid, state.map.depth),
        observation: mapObservation,
      };
      if (!options.includes(choice)) throw new Error(`Invalid path action: ${choice}`);
      pathChoices.push(choice);
      actions.push({ type: "path", choice });
      enterNode(state, Number(choice.split(":")[0]));
    } else enterNode(state, Number(options[0].split(":")[0]));
    const path = row[state.map.lane]!;
    /** 조우·보상·요구가 같은 갈래에서 같은 값을 읽는다. 갈래가 빠지면 세 갈래가 같은 적을 뱉는다 */
    const nodeSeed = state.map.depth * laneCount + state.map.lane;
    if (path === "omen") {
      // 두 번째 `omen`은 걸어 둔 약속을 **교체한다**. 삼키면 그 칸이 아무 일도 안 하고, 둘 다 들면
      // 같은 전투 하나로 호의가 두 번 들어온다 — 교체는 둘 다 아니다
      carried = (yield* askDemand(1, nodeSeed, true)) ?? carried;
      advanceMap(state);
    } else if (path === "rest") {
      // 강화할 카드가 없으면 그 칸은 서지 않는다 — 융합만 남은 덱은 실제로 그 자리다
      const raisable = upgradable(deck, cardMap);
      const restOptions = raisable.length ? ["heal", "remove", "upgrade"] : ["heal", "remove"];
      const rest = yield {
        phase: "rest",
        options: restOptions,
        bot: chooseRest(state.combat.player.hp, state.combat.player.maxHp, raisable.length > 0),
        observation: mapObservation,
      };
      if (!restOptions.includes(rest)) throw new Error(`Invalid rest action: ${rest}`);
      const choice = rest as RestChoice;
      const picked = choice === "upgrade" ? raisable : choice === "remove" ? [...deck] : [];
      const cardId = picked.length
        ? yield {
          phase: "rest_card",
          options: picked,
          bot: chooseRestCard(picked, cardMap, state.combat, choice === "upgrade"),
          observation: mapObservation,
        }
        : undefined;
      takeRest(state, [...patrons], deck, choice, cardId);
      syncUpgrades(cardMap, deck);
      actions.push({ type: "rest", choice });
      if (cardId !== undefined) actions.push({ type: "rest_card", choice: cardId });
      restChoices.push(choice);
      restCount += 1;
      advanceMap(state);
    } else {
      const lineup = encounter(seed + nodeSeed, region, floor, path);
      /** 실제로 선 적. 칸이 아니라 **사람 수**다 — 두 칸짜리 보스도 하나고, 요구의 `min_enemies`가 그 눈금이다 */
      const members = lineup;
      /** 이 조우가 무엇을 요구했는지. `--aura-matrix`가 개입의 부호를 여기서 갈라 읽는다 */
      const passives = [...new Set(members.flatMap(({ passives: own }) => Object.keys(own ?? {})))].sort();
      const devoted = patrons.filter((god) => favorStage(state.favor[god] ?? favorInitial) === "devotion");
      const promise = yield* askDemand(members.length, nodeSeed);
      const hpBefore = state.combat.player.hp;
      const result = yield* playEncounter(state, seed * 100 + nodeSeed, deck, cardMap, lineup, log, patrons, noise);
      turns += result.turns;
      blockBuilt += result.blockBuilt;
      blockAbsorbed += result.blockAbsorbed;
      targetSpread.push(...result.targetSpread);
      cardsPlayed.push(...result.cardsPlayed);
      enemyCounts.push(members.length);
      encounters += 1;
      // 편성 이름이 아니라 **자리**로 센다 — 층별 정책이 갈리는지 보려면 열이 층이어야 한다
      /** 이 조우를 선불 대가를 지고 들어섰는가. 「시련 중 사망」의 분자는 패배 맥락이고 분모가 이 줄이다 */
      const underTrial = Boolean(trial);
      encounterOutcomes.push({ key: `${region}:${floor}:${path}`, cleared: state.combat.outcome === "victory", passives, devoted, hpLost: hpBefore - state.combat.player.hp, trial: underTrial });
      // 기간이 끝나면 여유를 되돌린다. 체력은 안 돌려준다 — 치른 것은 치른 것이다
      if (trial) {
        if (trial.encounters > 1) trial = { maxHp: trial.maxHp, encounters: trial.encounters - 1 };
        else {
          state.combat.player.maxHp += trial.maxHp;
          trial = undefined;
        }
      }
      if (state.combat.outcome !== "victory") {
        defeatContext = { region, floor, enemies: members.map(({ id }) => id), passives, trial: underTrial };
        favorCurve.push({ ...state.favor });
        hpCurve.push(state.combat.player.hp);
        break;
      }
      // 전투 앞의 요구와 `omen`에서 걸어 둔 약속을 같은 사실로 판정한다
      for (const promised of [promise, carried]) {
        if (!promised) continue;
        const { demand, patron, other, choice, tier } = promised;
        // 지키지 못한 약속은 아무것도 움직이지 않는다 — 실패 벌금은 만들지 않는다. 선불 대가는 이미 나갔다
        const held = tier ? demandSatisfied(tier, result.facts) : false;
        resolveDemand(state.favor, patron, other, held ? tier : undefined);
        if (held && tier?.reward.upgrade) grantUpgrade(tier.reward.upgrade);
        // 시련의 보상은 그 신의 은혜 하나다 — `awardGrace`와 같은 상한(6)을 쓰고 3택1을 그 자리에서 띄운다
        if (held && tier?.reward.grace) {
          state.grace[patron] = Math.min(6, (state.grace[patron] ?? 0) + tier.reward.grace);
          yield* grantGrace(patron);
        }
        // 거절도 편을 든다 — 상대 신을 벌금에서 지켜 준 것이므로 그쪽이다
        demandSides.push(held ? patron : other);
        // 단이 키에 들어간다 — 단별 지킴률을 리포트가 따로 세지 않고 그대로 읽는다. 거절은 세지 않는다
        if (!tier) continue;
        const [asked, heldCount] = demandOutcomes[`${demand.id}:${choice}`] ?? [0, 0];
        demandOutcomes[`${demand.id}:${choice}`] = [asked + 1, heldCount + (held ? 1 : 0)];
      }
      carried = undefined;
      yield* offerReward(nodeSeed, path);
      // 은혜를 먼저 준다 — 합성 전제가 은혜 보유이므로 이 순서라야 마지막 은혜가 그 자리에서 합성을 연다
      for (const god of awardGrace(state.favor, state.grace, [...patrons])) yield* grantGrace(god);
      if (!fused && canFuse(state.grace, patrons)) {
        deck.push(fusedCard.id);
        fused = true;
      }
      advanceMap(state);
      if (floor === floorsPerRegion) regionsCleared.push(region);
    }
    favorCurve.push({ ...state.favor });
    hpCurve.push(state.combat.player.hp);
  }
  const won = state.map.depth === mapDepth && state.combat.player.hp > 0;
  log.push(`outcome=${won ? "victory" : state.combat.outcome} encounters=${encounters} turns=${turns} hp=${state.combat.player.hp}`);
  // 런당 요구는 최대 아홉 번이다 — 최빈값을 세는 데 정렬 한 줄이면 된다
  const conflictChoice = [...demandSides].sort((left, right) =>
    demandSides.filter((god) => god === right).length - demandSides.filter((god) => god === left).length)[0];
  return { won, grid: state.map.grid, turns, log, favorCurve, encounters, restCount, hpCurve, pathChoices, restChoices, regionsCleared, grace: state.grace, graceSlots: state.graceSlots, scenario, enemyCounts, encounterOutcomes, defeatContext, targetSpread, blockBuilt, blockAbsorbed, fused, actions, cardsPlayed, conflictChoice, demandOutcomes, pairing: patrons.join("+") };
}

/**
 * 스텝 제너레이터를 봇 기본값으로 끝까지 돌린다. action log에 있는 결정만 그 자리를 덮어쓴다.
 *
 * phase가 맞아도 그 선택이 지금 낼 수 있는 것이 아니면 쓰지 않는다 — 규칙이 바뀌면 옛 로그의
 * 카드열은 손에 없는 카드를 가리키고, 그때 엔진이 죽는 대신 봇이 답하고 `substituted`가 오른다
 */
export function run(seed: number, scenario?: Scenario, scriptedActions: ReplayAction[] = [], patrons: PatronPair = ["zeus", "athena"], startingDeck?: string[]): RunResult {
  const steps = runSteps(seed, scenario, patrons, startingDeck);
  let actionIndex = 0;
  let substituted = 0;
  let step = steps.next();
  while (!step.done) {
    const { phase, options, bot } = step.value;
    const scripted = scriptedActions[actionIndex]?.type === phase ? scriptedActions[actionIndex++] : undefined;
    if (scripted && !options.includes(scripted.choice)) substituted += 1;
    step = steps.next(scripted && options.includes(scripted.choice) ? scripted.choice : bot);
  }
  return { ...step.value, substituted };
}

export function simulate(runs: number, scenario?: Scenario): RunResult[] {
  return Array.from({ length: runs }, (_, index) => run(index + 1, scenario));
}

const pairings = gods.flatMap((left, index) => gods.slice(index + 1).map((right) => [left, right] as const));

export function simulateStratified(runs: number): RunResult[] {
  if (runs % pairings.length !== 0) throw new Error(`--stratified runs must be divisible by ${pairings.length}`);
  return Array.from({ length: runs }, (_, index) => {
    const pairing = pairings[index % pairings.length];
    const seed = Math.floor(index / pairings.length) + 1;
    // `pairing`은 run()이 이미 넣는다 — 여기서 다시 씌우지 않는다
    const result = { ...run(seed, undefined, [], pairing), conflictPenalty: demandPenalty(pairing[0], pairing[1]).key };
    // 읽는 쪽은 `--log`뿐이고 그것도 첫 런만 본다. 64,000런어치를 들고 있으면 힙이 터진다
    if (index > 0) result.log = [];
    return result;
  });
}

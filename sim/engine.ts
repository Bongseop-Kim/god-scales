import { admitPending, createCombat, endTurn, playCard, startTurn, updateOutcome, type EnemyAction, type EnemyDefinition, type Lineup } from "../core/combat.ts";
import { createRng } from "../core/rng.ts";
import cardDataJson from "../data/cards.json" with { type: "json" };
import demandDataJson from "../data/demands.json" with { type: "json" };
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import godDataJson from "../data/gods.json" with { type: "json" };
import graceDataJson from "../data/graces.json" with { type: "json" };
import mapDataJson from "../data/map.json" with { type: "json" };
import { applyFavorStageEffects, awardGrace, favorInitial, favorStage, finishCombatFavor, godEnemyId, intervenesOnTurn, recordCardFavor, wrathReconcileFavor, type FavorGod, type FavorUses } from "../core/favor.ts";
import { demandEnemies, demandPenalty, demandSatisfied, demandSettled, parseCondition, resolveDemand, ruleText, takeSide, type Demand, type DemandOffer } from "../core/demands.ts";
import { graceOffer, graceTier, type Grace } from "../core/grace.ts";
import { advanceMap, bossLane, enemyDamageScale, enterNode, floorsPerRegion, generateMap, laneCount, mapDepth, mapSlot, reachableLanes, takeRest, type MapGrid, type MapNodeType } from "../core/map.ts";
import { cardEffects, cardLevel, cardSaboteur, cardSealIds, MAX_UPGRADE, sealId, upgraded, type Card, type GodId } from "../core/rules.ts";
import { canReachTarget, livingInReach } from "../core/targeting.ts";
import type { CombatOutcome, GameState, Passives, Tokens, Trigger } from "../core/state.ts";
import { chooseCard, chooseDemandAnswer, chooseGrace, chooseGraceCard, choosePath, chooseRest, chooseRestCard, chooseReward, chooseTarget } from "./bots/rule.ts";
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
/** 은혜 45줄 = 설계 열다섯 × tier 셋. 선택한 줄은 카드 id에 인장으로 남는다. */
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
 *
 * **노드 종류는 안 바꾼다** — 지도의 칸은 지도가 정한다. 일반 전투는 진노 신이 섰더라도 일반 보상이다.
 */
const tier2Slots = (path: MapNodeType): number => (path === "elite" || path === "boss" ? 3 : 0);
/** 테스트가 부른다 — 자리 수보다 후보가 적을 때 던지는 가드는 배포 데이터로는 못 만드는 상황이다 */
export function rewardOffer(random: () => number, patrons: readonly string[], tier2 = 0): string[] {
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
  size?: 1 | 2 | 3 | 4;
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
    size: enemy.size,
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
    // 보스 크기는 적 데이터가 정한다 — 여기서 다시 적으면 데이터와 실제 조우가 어긋난다
    return [enemyDefinition(boss)];
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
type SealView = NonNullable<Card["seals"]>[number];
export type CardView = { id: string; name: string; cost: number; target: Card["target"]; effects: Card["effects"]; reach?: string; weakened?: boolean; seals?: SealView[]; previewSeal?: SealView; fusesTo?: CardView };
const cardView = ({ id, name, cost, target, effects, reach, seals }: Card): CardView => ({ id, name, cost, target, effects, ...(reach ? { reach } : {}), ...(seals?.length ? { seals } : {}) });
export const allCards = cards.map((card) => ({ ...cardView(card), patron: card.patron, patronPair: card.patronPair }));
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
export function materializeCard(card: Card, id: string, allGraces: Grace[]): Card {
  const raised = upgraded(card, cardLevel(id).level);
  const seals = cardSealIds(id).map(({ id: graceId, tier }) => {
    const seal = allGraces.find((grace) => grace.id === graceId && grace.tier === tier);
    if (!seal) throw new Error(`Unknown seal: ${graceId}.${tier}`);
    return seal;
  });
  return { ...raised, id, effects: [...raised.effects, ...seals.flatMap(({ effects }) => effects)], ...(seals.length ? { seals } : {}) };
}
export const fusionReady = (card: Pick<Card, "seals">, pair: PatronPair): boolean =>
  pair.every((patron) => card.seals?.some(({ patron: sealed }) => sealed === patron));

function syncCards(cardMap: Map<string, Card>, deck: readonly string[]): void {
  for (const id of deck) {
    if (cardMap.has(id)) continue;
    const { base } = cardLevel(id);
    const card = cardMap.get(base);
    if (!card) throw new Error(`Unknown derived card: ${id}`);
    cardMap.set(id, materializeCard(card, id, graces));
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
const runView = (state: GameState, patrons: PatronPair, deck: readonly string[], cardMap: ReadonlyMap<string, Card>): RunView => {
  const { region, floor } = mapSlot(state.map.depth);
  return { depth: state.map.depth, lane: state.map.lane, region, floor, hp: state.combat.player.hp, maxHp: state.combat.player.maxHp, patrons, grid: state.map.grid, favor: { ...state.favor }, grace: { ...state.grace }, deck: deck.map((id) => cardView(cardMap.get(id)!)) };
};
/**
 * 모든 관측이 공유한다. `patrons`는 런 내내 고정이고, 화면 머리글이 조합 이름을 여기서 읽는다.
 * 위치도 격자도 여기 있다 — UI가 시드로 `generateMap`을 다시 풀면 같은 사실에 두 경로가 생긴다.
 * `favor`·`grace`는 조합 둘의 것만 든다 — 나머지 셋은 아무것도 움직이지 않으므로 칸이 아예 없다(R-26).
 * `deck`은 P-53의 덱 오버레이가 어느 phase에서나 읽는다 — 규칙·값 불변, 관측 확장이다
 */
export type RunView = {
  depth: number; lane: number; region: string; floor: number; hp: number; maxHp: number; patrons: PatronPair; grid: MapGrid;
  favor: Record<string, number>;
  grace: Record<string, number>;
  deck: CardView[];
  /** 맵에서 들고 있는 과업. 판정할 수 없는 전투에서도 이월 상태를 보여 준다 */
  quest?: PromiseView;
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
  /** 분노 이하인 신이 다른 후원 신의 카드를 무디게 한다. 현재 호의에서 매 관측마다 파생한다. */
  sabotages: { god: GodId; patron: GodId }[];
  /** 전투 내내 매 턴 일한다 — 화면에 없으면 몇 장 냈는지 플레이어가 세고 있어야 한다 */
  powers: PowerView[];
  enemies: EnemyView[];
  /** 지난 yield 이후 깎인 체력. `id`는 적 id 또는 `player` */
  hits: { id: string; amount: number }[];
  /** 같은 hits를 만든 주체. 피해 연출이 신의 개입을 병사의 공격으로 오인하지 않게 한다 */
  hitSource?: "attack" | "card" | "power" | "favor" | "enemy";
  /** hits가 새로 생길 때마다 오른다 — UI가 같은 팝을 두 번 재생하지 않게 하는 열쇠 */
  hitSeq: number;
  /**
   * 이 hits에서 지킴이가 대신 받은 피해. **새 seq를 만들지 않는다** — 재지정은 언제나 피해와 같은
   * 프레임에 온다. 빈 배열이면 아무 일도 없었다는 뜻이다(`core/state.ts`의 `guarded`)
   */
  guarded: { by: string; from: string }[];
  /** 판정 가능한 이번 전투의 과업 하나 */
  promises: PromiseView[];
  /** 방금 찢긴 카드(진노인 신의 카드). `seq`는 `hitSeq`와 같은 이유로 있다 — 한 번만 외친다 */
  torn?: { card: string; god: string; seq: number };
  /** target phase에서 지금 내려는 카드 */
  card?: string;
};
/**
 * 과업 한 줄. `current`·`settled`는 `facts`와 조건에서 **계산된다** — 상태를 따로 들면 그것이
 * 사실과 어긋날 자리가 생기고, `facts`는 이미 단조라 계산이 언제나 맞다(`core/demands.ts`).
 */
export type PromiseView = { god: string; text: string; rule: string; current: number; target: number; settled?: "kept" | "broken"; deferred?: boolean };
type Quest = { demand: Demand; patron: GodId };
const questView = ({ demand, patron }: Quest, facts: Record<string, number> = {}): PromiseView => {
  const { fact, target } = parseCondition(demand.condition);
  return { god: patron, text: demand.text, rule: ruleText(demand.condition), current: facts[fact] ?? 0, target };
};
/** `text`는 그 층의 문장이다 — 지도 화면이 지금 어디 서 있는지 한 줄로 읽는다 */
type MapObservation = RunView & { text: string };
type RewardObservation = RunView & { cards: CardView[]; questResult?: PromiseView; questReward?: boolean; finale?: CombatObservation };
/** 은혜 후보 하나. 선택한 tier의 효과가 그대로 대상 카드에 새겨진다. */
type GraceOffer = { id: string; tier: number; text: string; effects: Card["effects"] };
type GraceObservation = RunView & { god: string; tier: number; offer: GraceOffer[] };
type GraceCardObservation = RunView & { god: string; tier: number; seal: GraceOffer };
/**
 * 과업 노드의 선택. 두 신과 지나가기를 항상 싣는다.
 */
type DemandObservation = RunView & { offers: DemandOffer[] };
/** 봇이 고를 값(`bot`)을 같이 내보낸다 — 답을 채우지 않으면 이것이 쓰이고, 정책은 엔진 안에만 남는다 */
export type CombatDecision = { phase: "card" | "target"; options: string[]; bot: string; observation: CombatObservation };
export type MapDecision = { phase: "path" | "rest" | "rest_card"; options: string[]; bot: string; observation: MapObservation };
export type RewardDecision = { phase: "reward"; options: string[]; bot: string; observation: RewardObservation };
export type GraceDecision = { phase: "grace"; options: string[]; bot: string; observation: GraceObservation };
export type GraceCardDecision = { phase: "grace_card"; options: string[]; bot: string; observation: GraceCardObservation };
export type DemandDecision = { phase: "demand"; options: string[]; bot: string; observation: DemandObservation };
export type Decision = CombatDecision | MapDecision | RewardDecision | GraceDecision | GraceCardDecision | DemandDecision;
export const endTurnAction = "end_turn";
/** 과업 노드에서 아무것도 새로 고르지 않는다 */
export const watchDemand = "reject";

type EncounterResult = {
  turns: number;
  blockBuilt: number;
  blockAbsorbed: number;
  targetSpread: ("single" | "multi")[];
  cardsPlayed: string[];
  /**
   * `demandSatisfied`가 읽는 이름들이다 — 요구 조건 DSL의 좌변과 같은 키여야 한다.
   * 과업 데이터의 조건 DSL과 같은 키다.
   */
  facts: Record<string, number>;
  /** 이 조우에서 꺾은 진노 신들. 화해(호의 회복)가 이 한 줄을 읽는다 */
  felled: string[];
  /** 전투를 끝낸 행동까지 반영한 마지막 관측. 새 결정 없이 UI 아웃트로만 이어 받는다 */
  finale: CombatObservation;
};

/** 카드 한 장을 목록에서 뺀다. 없으면 아무 일도 없다 — `splice(-1)`이 엉뚱한 장을 지우는 자리다 */
const drop = (cards: string[], id: string): void => {
  const at = cards.indexOf(id);
  if (at >= 0) cards.splice(at, 1);
};

function* playEncounter(state: GameState, seed: number, deck: string[], cardMap: Map<string, Card>, lineup: Lineup, log: string[], patrons: PatronPair, noise: () => number, quest?: Quest, deferred = false): Generator<Decision, EncounterResult, string> {
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
  /**
   * 진노가 부른 신들. **이긴 조우에서는 예외 없이 쓰러져 있다** — 승리는 「큐가 비고 판이 빈 것」이라
   * (`updateOutcome`) 선 신은 전부 죽었다. 시체를 세지 않는 이유는 뒤에 들어온 신이 그 칸을
   * 덮어쓰기 때문이다(`admitPending`). 진노는 조우 시작에만 부른다(`data/gods.json`)
   */
  const joined = [...state.combat.pending];
  // 진노가 큐에 넣은 신을 여기서 세운다 — 4칸이 꽉 차 있으면 문 앞에서 기다리고 `endTurn`이 다시 본다
  admitPending(state.combat, enemyMap);
  const uses: FavorUses = {};
  let blockBuilt = 0;
  let blockAbsorbed = 0;
  const targetSpread: ("single" | "multi")[] = [];
  const cardsPlayed: string[] = [];
  let hits: CombatObservation["hits"] = [];
  let hitSource: CombatObservation["hitSource"];
  let hitSeq = 0;
  let guarded: CombatObservation["guarded"] = [];
  const facts = { hit_targets_in_turn: 0, damage_taken: 0, tokens_applied: 0, tokens_applied_in_turn: 0, turns: 0 };
  /** 찢긴 카드. 화면이 규칙(「진노인 신의 카드」)을 다시 계산하면 규칙이 갈릴 때 화면만 옛 자리에 남는다 */
  let torn: CombatObservation["torn"];
  let turnTargets = new Set<string>();
  let turnTokens = 0;
  const healthBar = () => [["player", state.combat.player.hp] as const, ...state.combat.enemies.map(({ id, hp: enemyHp }) => [id, enemyHp] as const)];
  /** 카드일 때만 맞은 적을 센다 — 출혈 도트와 신의 개입은 이번 턴에 "친" 것이 아니다 */
  const recordHits = (before: (readonly [string, number])[], source: NonNullable<CombatObservation["hitSource"]>) => {
    const now = new Map(healthBar());
    const damage = before.flatMap(([id, hp]) => {
      const lost = hp - (now.get(id) ?? hp);
      return lost > 0 ? [{ id, amount: Math.round(lost * 10) / 10 }] : [];
    });
    for (const { id, amount } of damage) {
      if (id === "player") facts.damage_taken += amount;
      else if (source === "attack" || source === "card") turnTargets.add(id);
    }
    // 재지정은 **플레이어 카드에서만** 난다 — 다른 출처의 프레임에 지난 카드의 기록이 남으면 화면이
    // 적 턴 피해에 지킴이를 내보낸다. 피해가 없는 프레임에서도 다시 적는다(`return` 앞이다) — 안 그러면
    // 지난 대신 맞기가 상태 줄(`combat.tsx`의 `guardLine`)에 계속 서 있다. `hits`·`hitSeq`는 반대다:
    // seq가 안 오르면 화면이 아무것도 다시 재생하지 않고, 비우면 700ms 피해 팝이 날아가는 중에 사라진다
    guarded = source === "attack" || source === "card" ? state.combat.guarded : [];
    if (!damage.length) return;
    hits = damage;
    hitSource = source;
    hitSeq += 1;
  };
  /** 과업을 지금 사실로 다시 푼다. 확정값은 단조 사실에서 나와 같은 전투 안에서 뒤집히지 않는다 */
  const promiseViews = (): PromiseView[] => {
    if (!quest) return [];
    if (deferred) return [{ ...questView(quest), deferred: true }];
    const { fact, target } = parseCondition(quest.demand.condition);
    const settled = demandSettled(quest.demand.condition, facts);
    return [{ god: quest.patron, text: quest.demand.text, rule: ruleText(quest.demand.condition), current: facts[fact as keyof typeof facts] ?? 0, target, ...(settled ? { settled } : {}) }];
  };
  const observation = (): CombatObservation => ({
    ...runView(state, patrons, deck, cardMap),
    ...(quest ? { quest: questView(quest, facts) } : {}),
    turn: state.combat.turn,
    block: state.combat.player.block,
    tokens: { ...state.combat.player.tokens },
    energy: state.combat.energy,
    draw: state.combat.drawPile.length,
    // 손패는 **인장이 붙은 뒤의** 효과를 싣는다 — 캡션이 카드 원문만 적으면 인장 카드가
    // 카드가 화면에서 거짓말을 하고, 그러면 화면만 보고 턴을 계산할 수 없다. 낼 때 도는 목록과 같다
    hand: state.combat.hand.map((id) => {
      const card = cardMap.get(id)!;
      const weakened = !!cardSaboteur(state, card.patron);
      return { ...cardView(card), effects: cardEffects(state, card), ...(weakened ? { weakened } : {}) };
    }),
    sabotages: patrons.flatMap((patron) => {
      const god = cardSaboteur(state, patron);
      return god ? [{ god, patron }] : [];
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
    hitSource,
    hitSeq,
    guarded,
    promises: promiseViews(),
    ...(torn ? { torn } : {}),
  });

  while (state.combat.outcome === "ongoing") {
    const beforeTurnStart = healthBar();
    startTurn(state, random);
    recordHits(beforeTurnStart, "power");
    // 제우스의 축. 다른 넷과 같이 단조 비감소라 `demandSettled`가 그대로 돈다 — 한 턴 더 쓰면 굳는다
    facts.turns = state.combat.turn;
    // 전투 중 개입. `startTurn` **뒤**여야 방어 리셋(`core/combat.ts:73`) 뒤에 아테나의 방어가 살아남고,
    // 파워·뽑은 손패와 같은 화면에 선다. 죽인 적은 `updateOutcome`이 거둔다 — 안 거두면 `rally`가 안 돌고
    // 마지막 적을 개입이 죽인 조우가 시간 초과까지 간다
    if (state.combat.outcome === "ongoing" && intervenesOnTurn(state.combat.turn)) {
      const beforeAura = healthBar();
      const blockBefore = state.combat.player.block;
      applyFavorStageEffects(state, patronGods(), "on_turn_start");
      // 개입이 준 방어도 쌓은 방어다 — 안 세면 `block_efficiency`의 분모가 빠져 효율이 1을 넘는다
      blockBuilt += state.combat.player.block - blockBefore;
      recordHits(beforeAura, "favor");
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
      // 카드가 직접 든 인장 효과까지 같이 센다 — 화면과 요구 집계가 같은 목록을 읽는다
      const played = cardEffects(state, card);
      // 조건 없는 방어만 센다 — 아래 토큰과 같은 이유다. `when`이 걸린 방어는 붙었는지 여기서 알 수 없고,
      // 세면 `block_efficiency`의 분모가 쌓지 않은 방어까지 든다
      blockBuilt += played.reduce((sum, effect) => sum + (effect.op === "block" && !effect.when ? effect.value ?? 0 : 0), 0);
      targetSpread.push(card.target === "all_enemies" || played.some(({ op }) => op === "chain") ? "multi" : "single");
      const beforeCard = healthBar();
      playCard(state, cardMap, cardId, target, random);
      recordHits(beforeCard, card.tags.includes("attack") ? "attack" : "card");
      // 조건 없는 토큰만 센다 — `when`이 걸린 효과는 붙었는지 여기서 알 수 없으므로 세지 않는다
      const applied = played.reduce((sum, effect) => sum + (effect.op === "apply_token" && !effect.when ? effect.stacks ?? 1 : 0), 0);
      facts.tokens_applied += applied;
      turnTokens += applied;
      /**
       * 찢기 — 진노인 신의 카드를 내면 **효과는 그대로 나가고** 그 카드가 사라진다. 신은 힘을 빌려준 뒤
       * 거둬 간다. 효과까지 막으면 손패를 눌렀는데 아무 일도 안 일어난 것이고, 그건 연출이 아니라 버그로
       * 읽힌다. 덱과 이번 전투의 버림더미 둘 다에서 뺀다 — 버림더미에 두면 이 조우 안에서 다시 뽑힌다.
       * 「버린 신의 카드를 안 쓰고 이길 수 있는가」가 100:0의 진짜 판돈이다. `recordCardFavor` **앞**이다:
       * +1이 경계를 넘겨도 낸 순간의 단계로 판정한다
       */
      if (card.patron && favorStage(state.favor[card.patron] ?? favorInitial) === "wrath") {
        drop(deck, cardId);
        drop(state.combat.discardPile, cardId);
        torn = { card: cardId, god: card.patron, seq: (torn?.seq ?? 0) + 1 };
      }
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
      endTurn(state, enemyMap, random);
      recordHits(beforeTurn, "enemy");
      blockAbsorbed += Math.max(0, block - state.combat.player.block);
    }
  }
  const finale = observation();
  finishCombatFavor(state.favor, [...patrons], uses);
  const felled = state.combat.outcome === "victory" ? patrons.filter((god) => joined.includes(godEnemyId(god))) : [];
  return { turns: state.combat.turn, blockBuilt, blockAbsorbed, targetSpread, cardsPlayed, facts, felled, finale };
}

/** 시작 호의의 총합. 배분은 이 하나를 둘로 나눈다 */
export const favorPool = 100;

/**
 * `startingDeck`이 자유 모드의 전부다 — **엔진에 모드 플래그가 없다.** 안 넘기면 규칙 덱이고,
 * `tune`·`sim`·`heatmap`이 안 넘기므로 그것이 곧 게이트에서의 제외다. `--free` 같은 CLI 옵션을
 * 만들지 않는 이유도 같다: 만드는 순간 누군가 그걸로 게이트를 돌린다
 */
export function* runSteps(
  seed: number,
  scenario?: Scenario,
  patrons: PatronPair = ["zeus", "athena"],
  startingDeck: string[] = ruleDeck(patrons),
  /**
   * `patrons[0]`이 가진 몫. 나머지(`favorPool - split`)가 `patrons[1]`이다 — **한 숫자가 둘을 정한다.**
   * 값을 둘 받으면 합이 100이 아닌 상태가 표현 가능해지고, 그러면 그것을 막는 검사가 화면·엔진·게이트
   * 세 곳에 생긴다. 배분은 **시작값만** 정한다: 시작 뒤에는 감쇠·카드·과업·개입이 각자 민다.
   *
   * **`scenario`를 늘리지 않는다** — 시나리오는 시뮬이 재는 고정 상태 셋이고 이건 사람이 시작 화면에서
   * 돌리는 축이다. 둘을 한 자리에 놓으면 `--scenario split_80`류가 끝없이 붙는다
   */
  split: number = favorPool / 2,
): Generator<Decision, RunResult, string> {
  // `readReplay`는 파일만 지킨다 — 직접 호출자(러너 플래그 포함)가 음수·소수·NaN을 넘기면 여기서 끊는다
  if (!Number.isInteger(split) || split < 0 || split > favorPool) throw new Error(`split ${split}: 정수 [0, ${favorPool}]만 받는다`);
  const fusedCard = fusionCards.find(({ patronPair }) => patronPair?.every((god) => patrons.includes(god)));
  if (!fusedCard) throw new Error(`${patrons.join("+")}: no fused card for this pairing`);
  const fusionCard = fusedCard;
  const deck = [...startingDeck, ...(scenario === "fused_deck" ? [fusedCard.id] : [])];
  const cardMap = new Map(cards.map((card) => [card.id, structuredClone(card)]));
  const graced = scenario === "grace_4" ? 4 : scenario === "grace_6" ? 6 : 0;
  const state: GameState = {
    seed,
    combat: createCombat(seed, deck, []),
    favor: { [patrons[0]]: graced ? 70 : split, [patrons[1]]: favorPool - split },
    grace: { [patrons[0]]: 0, [patrons[1]]: 0 },
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
  let fusions = scenario === "fused_deck" ? 1 : 0;
  const actions: ReplayAction[] = [];
  /** 과업마다 편든 신 — 통계가 가장 자주 고른 신을 읽는다 */
  const demandSides: string[] = [];
  const demandOutcomes: Record<string, [number, number]> = {};
  /** 맵의 과업 노드에서 받은 단일 슬롯. 새 선택은 이 값 하나를 교체한다 */
  let quest: Quest | undefined;
  let defeatFinale: CombatObservation | undefined;
  const view = (): RunView => ({ ...runView(state, patrons, deck, cardMap), ...(quest ? { quest: questView(quest) } : {}) });

  function* grantGrace(god: string): Generator<Decision, void, string> {
    const tier = graceTier(state.grace[god] ?? 0);
    const offer = graceOffer(graces, god, tier);
    if (!offer.length) return;
    const options = offer.map(({ id }) => id);
    const choice = yield {
      phase: "grace",
      options,
      bot: chooseGrace(offer) ?? options[0],
      observation: {
        ...view(),
        god,
        tier,
        offer: offer.map(({ id, tier: level, text, effects }) => ({ id, tier: level, text, effects })),
      },
    };
    if (!options.includes(choice)) throw new Error(`Invalid grace action: ${choice}`);
    actions.push({ type: "grace", choice });
    const grace = offer.find(({ id }) => id === choice)!;
    const cardOptions = [...new Set(deck.filter((id) => !cardMap.get(id)?.seals?.some(({ patron }) => patron === god)))];
    if (!cardOptions.length) return;
    const baseView = view();
    const pickedCard = yield {
      phase: "grace_card",
      options: cardOptions,
      bot: chooseGraceCard(cardOptions, cardMap, god) ?? cardOptions[0],
      observation: {
        ...baseView,
        god,
        tier,
        seal: { id: grace.id, tier: grace.tier, text: grace.text, effects: grace.effects },
        deck: baseView.deck.map((card) => {
          if (!cardOptions.includes(card.id)) return card;
          const seals = [...(card.seals ?? []), grace];
          const merges = fusionReady({ ...card, seals }, patrons);
          return { ...card, previewSeal: grace, ...(merges ? { fusesTo: cardView(fusionCard) } : {}) };
        }),
      },
    };
    if (!cardOptions.includes(pickedCard)) throw new Error(`Invalid grace card action: ${pickedCard}`);
    const at = deck.indexOf(pickedCard);
    const sealedId = sealId(pickedCard, grace);
    const source = cardMap.get(cardLevel(sealedId).base)!;
    cardMap.set(sealedId, materializeCard(source, sealedId, graces));
    if (fusionReady(cardMap.get(sealedId)!, patrons)) {
      deck[at] = fusionCard.id;
      fusions += 1;
    } else deck[at] = sealedId;
    actions.push({ type: "grace_card", choice: pickedCard });
  }

  const demandOffers = (): DemandOffer[] => patrons.flatMap((god, index) => {
    const demand = demandData.find(({ patron }) => patron === god);
    if (!demand) return [];
    const other = patrons[1 - index];
    return [{ action: god, god, other, text: demand.text, rule: ruleText(demand.condition), reward: demand.reward, penalty: demandPenalty(god, other).amount }];
  });

  function* askQuest(): Generator<Decision, Quest | undefined, string> {
    const offers = demandOffers();
    const options = [...offers.map(({ action }) => action), watchDemand];
    const choice = yield {
      phase: "demand",
      options,
      bot: chooseDemandAnswer(offers, state.favor, patrons[0]),
      observation: { ...view(), offers },
    };
    if (!options.includes(choice)) throw new Error(`Invalid demand action: ${choice}`);
    actions.push({ type: "demand", choice });
    if (choice === watchDemand) return undefined;
    const patron = choice as GodId;
    const other = patrons[0] === patron ? patrons[1] : patrons[0];
    const demand = demandData.find(({ patron: god }) => god === patron)!;
    takeSide(state.favor, patron, other);
    demandSides.push(patron);
    const [asked, kept] = demandOutcomes[demand.id] ?? [0, 0];
    demandOutcomes[demand.id] = [asked + 1, kept];
    return { demand, patron };
  }

  function* offerReward(nodeSeed: number, path: MapNodeType, questResult?: PromiseView, finale?: CombatObservation): Generator<Decision, void, string> {
    // 전투/셔플과 겹치지 않는 새 스트림이다. 겹치면 기존 replay 재생이 깨진다
    const offer = rewardOffer(createRng(seed * 1000 + nodeSeed), patrons, tier2Slots(path));
    const picked = yield {
      phase: "reward",
      options: [...offer, skipReward],
      bot: chooseReward(offer, cardMap, noise),
      observation: { ...view(), cards: offer.map((id) => cardView(cardMap.get(id)!)), ...(questResult ? { questResult } : {}), ...(finale ? { finale } : {}) },
    };
    if (picked !== skipReward && !offer.includes(picked)) throw new Error(`Invalid reward action: ${picked}`);
    if (picked) deck.push(picked);
    actions.push({ type: "reward", choice: picked });
  }

  function* offerQuestReward(done: Quest, nodeSeed: number, questResult: PromiseView): Generator<Decision, void, string> {
    const offer = rewardOffer(createRng(seed * 1000 + nodeSeed), [done.patron]);
    const picked = yield {
      phase: "reward",
      options: offer,
      bot: chooseReward(offer, cardMap, noise),
      observation: { ...view(), cards: offer.map((id) => cardView(cardMap.get(id)!)), questResult, questReward: true },
    };
    if (!offer.includes(picked)) throw new Error(`Invalid quest reward action: ${picked}`);
    deck.push(picked);
    actions.push({ type: "reward", choice: picked });
  }

  // 시나리오는 은혜를 미리 받은 상태에서 출발한다 — 획득 순서대로 tier가 오르므로 한 개씩 준다
  for (let earned = 1; earned <= graced; earned += 1) {
    state.grace[patrons[0]] = earned;
    yield* grantGrace(patrons[0]);
  }

  while (state.map.depth < mapDepth && state.combat.player.hp > 0) {
    const { region, floor } = mapSlot(state.map.depth);
    const row = state.map.grid[state.map.depth];
    const options = reachableLanes(state.map.depth, state.map.lane).map((lane) => `${lane}:${row[lane]}`);
    const mapObservation: MapObservation = { ...view(), text: mapSlots.get(`${region}:${floor}`)!.text };
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
      // 지나가면 기존 과업을 유지하고, 새로 고르면 단일 슬롯을 교체한다
      quest = (yield* askQuest()) ?? quest;
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
      syncCards(cardMap, deck);
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
      // 적이 모자라 판정할 수 없으면 이월로 보여 주고 다음 전투까지 그대로 넘긴다
      const activeQuest = quest && demandEnemies(quest.demand.condition, quest.demand.min_enemies) <= members.length ? quest : undefined;
      const hpBefore = state.combat.player.hp;
      const result = yield* playEncounter(state, seed * 100 + nodeSeed, deck, cardMap, lineup, log, patrons, noise, quest, !!quest && !activeQuest);
      const questResult = activeQuest
        ? { ...questView(activeQuest, result.facts), settled: demandSatisfied(activeQuest.demand.condition, result.facts) ? "kept" as const : "broken" as const }
        : undefined;
      // 판정 가능한 전투 한 판이 끝났으므로 승패와 무관하게 슬롯을 비운다
      if (activeQuest) {
        quest = undefined;
        if (questResult?.settled === "kept") demandOutcomes[activeQuest.demand.id]![1] += 1;
      }
      /**
       * 꺾으면 화해한다 — 호의가 평온 하한으로 돌아가므로 그 신은 다음 조우에 다시 서지 않는다.
       * 개입이 진노(신 합류)에서 평온(작은 도움)으로 바뀌는 것이 이 조우의 가장 큰 보상이다.
       * 감쇠 한 줄이 아니라 값을 **놓는다**: 「진노 이전으로」가 아니라 「휴전선까지」다
       */
      for (const god of result.felled) state.favor[god] = wrathReconcileFavor;
      turns += result.turns;
      blockBuilt += result.blockBuilt;
      blockAbsorbed += result.blockAbsorbed;
      targetSpread.push(...result.targetSpread);
      cardsPlayed.push(...result.cardsPlayed);
      enemyCounts.push(members.length);
      encounters += 1;
      // 편성 이름이 아니라 **자리**로 센다 — 층별 정책이 갈리는지 보려면 열이 층이어야 한다
      encounterOutcomes.push({ key: `${region}:${floor}:${path}`, cleared: state.combat.outcome === "victory", passives, devoted, hpLost: hpBefore - state.combat.player.hp });
      if (state.combat.outcome !== "victory") {
        defeatFinale = result.finale;
        defeatContext = { region, floor, enemies: members.map(({ id }) => id), passives };
        favorCurve.push({ ...state.favor });
        hpCurve.push(state.combat.player.hp);
        break;
      }
      // 모든 승리는 기본 카드 보상을 먼저 받는다. 최종 판정은 저널이 놓치지 않도록 이 관측에도 싣는다
      yield* offerReward(nodeSeed, path, questResult, result.finale);
      if (activeQuest && questResult?.settled === "kept") {
        resolveDemand(state.favor, activeQuest.patron, activeQuest.demand.reward);
        yield* offerQuestReward(activeQuest, nodeSeed, questResult);
      }
      for (const god of awardGrace(state.favor, state.grace, [...patrons])) yield* grantGrace(god);
      advanceMap(state);
      if (floor === floorsPerRegion) regionsCleared.push(region);
    }
    favorCurve.push({ ...state.favor });
    hpCurve.push(state.combat.player.hp);
  }
  const won = state.map.depth === mapDepth && state.combat.player.hp > 0;
  log.push(`outcome=${won ? "victory" : state.combat.outcome} encounters=${encounters} turns=${turns} hp=${state.combat.player.hp}`);
  // 런에서 가장 자주 고른 과업의 신 — 최빈값을 세는 데 정렬 한 줄이면 된다
  const conflictChoice = [...demandSides].sort((left, right) =>
    demandSides.filter((god) => god === right).length - demandSides.filter((god) => god === left).length)[0];
  return { won, grid: state.map.grid, turns, log, favorCurve, encounters, restCount, hpCurve, pathChoices, restChoices, regionsCleared, grace: state.grace, scenario, enemyCounts, encounterOutcomes, defeatContext, targetSpread, blockBuilt, blockAbsorbed, fused: fusions > 0, actions, cardsPlayed, conflictChoice, demandOutcomes, pairing: patrons.join("+"), ...(defeatFinale ? { finale: defeatFinale } : {}) };
}

/**
 * 스텝 제너레이터를 봇 기본값으로 끝까지 돌린다. action log에 있는 결정만 그 자리를 덮어쓴다.
 *
 * phase가 맞아도 그 선택이 지금 낼 수 있는 것이 아니면 쓰지 않는다 — 규칙이 바뀌면 옛 로그의
 * 카드열은 손에 없는 카드를 가리키고, 그때 엔진이 죽는 대신 봇이 답하고 `substituted`가 오른다
 */
export function run(seed: number, scenario?: Scenario, scriptedActions: ReplayAction[] = [], patrons: PatronPair = ["zeus", "athena"], startingDeck?: string[], split?: number): RunResult {
  const steps = runSteps(seed, scenario, patrons, startingDeck, split);
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

/** `split`은 `--split` 러너 플래그 하나가 넘긴다 — **게이트는 안 넘긴다**(`tools/tune.ts`가 안 쓴다) */
export function simulate(runs: number, scenario?: Scenario, split?: number): RunResult[] {
  return Array.from({ length: runs }, (_, index) => run(index + 1, scenario, [], undefined, undefined, split));
}

const pairings = gods.flatMap((left, index) => gods.slice(index + 1).map((right) => [left, right] as const));

export function simulateStratified(runs: number, split?: number): RunResult[] {
  if (runs % pairings.length !== 0) throw new Error(`--stratified runs must be divisible by ${pairings.length}`);
  return Array.from({ length: runs }, (_, index) => {
    const pairing = pairings[index % pairings.length];
    const seed = Math.floor(index / pairings.length) + 1;
    // `pairing`은 run()이 이미 넣는다 — 여기서 다시 씌우지 않는다
    const result = { ...run(seed, undefined, [], pairing, undefined, split), conflictPenalty: demandPenalty(pairing[0], pairing[1]).key };
    // 읽는 쪽은 `--log`뿐이고 그것도 첫 런만 본다. 64,000런어치를 들고 있으면 힙이 터진다
    if (index > 0) result.log = [];
    return result;
  });
}

import { createCombat, endTurn, playCard, startTurn, type EnemyAction, type EnemyDefinition } from "../core/combat.ts";
import { createRng } from "../core/rng.ts";
import cardDataJson from "../data/cards.json" with { type: "json" };
import demandDataJson from "../data/demands.json" with { type: "json" };
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import godDataJson from "../data/gods.json" with { type: "json" };
import graceDataJson from "../data/graces.json" with { type: "json" };
import mapDataJson from "../data/map.json" with { type: "json" };
import { applyFavorStageEffects, awardGrace, demandReward, favorInitial, favorStage, finishCombatFavor, recordCardFavor, type FavorGod, type FavorUses } from "../core/favor.ts";
import { demandPenalty, demandSatisfied, resolveDemand, type Demand } from "../core/demands.ts";
import { graceOffer, graceSlots, graceTier, takeGrace, type Grace, type GraceSlot } from "../core/grace.ts";
import { advanceMap, bossLane, enemyDamageScale, enterNode, floorsPerRegion, generateMap, laneCount, mapDepth, mapSlot, reachableLanes, takeRest, type MapGrid, type MapNodeType } from "../core/map.ts";
import { canFuse } from "../core/fusion.ts";
import { cardEffects, type Card, type GodId } from "../core/rules.ts";
import type { GameState, Passives, Tokens } from "../core/state.ts";
import { chooseCard, chooseDemandAnswer, chooseGrace, choosePath, chooseRest, chooseRestCard, chooseReward, chooseTarget } from "./bots/rule.ts";
import { renderPlay } from "./log.ts";
import type { RunResult } from "./report.ts";
import type { ReplayAction } from "./replay.ts";

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
const auraGods = (): FavorGod[] => devotionOff
  ? godData.map((god) => ({ ...god, stage_effects: { wrath: god.stage_effects.wrath } }))
  : godData;
/** 화면에는 `text`만 나간다 — `condition` DSL은 사람이 읽을 문장이 아니다 */
const demandData = demandDataJson as Demand[];
/** 층별 편성과 텍스트. 지역 하나가 아니라 `(층, 종류)`가 조우를 고르는 단위가 됐다 */
type MapSlotData = { id: string; region: string; floor: number; text: string; groups: Partial<Record<"combat" | "elite", string[]>> };
const mapData = mapDataJson as MapSlotData[];
const mapSlots = new Map(mapData.map((slot) => [`${slot.region}:${slot.floor}`, slot]));
/** 정예를 놓을 수 있는 층 = 정예 편성이 있는 층. 층을 코드로 열면 없는 편성을 찾게 된다 */
export const eliteSlots = new Set(mapData.filter(({ groups }) => groups.elite?.length).map(({ region, floor }) => `${region}:${floor}`));

/** 시작 덱의 3장은 신별 태그가 정한다 — 공격 1 · 방어 1 · 유틸 1, 같은 비용이면 데이터 순서 */
function starterCards(god: GodId): [string, string, string] {
  const own = cards.filter((card) => card.patron === god).sort((a, b) => a.cost - b.cost);
  const picked: string[] = [];
  for (const tag of ["attack", "defend", "utility"] as const) {
    const card = own.find(({ id, tags }) => tags.includes(tag) && !picked.includes(id));
    if (!card) throw new Error(`${god}: starter deck needs a ${tag} card`);
    picked.push(card.id);
  }
  return picked as [string, string, string];
}
export const godDecks = Object.fromEntries(gods.map((god) => [god, starterCards(god)])) as Record<GodId, [string, string, string]>;

/** 보상은 조합에 속한 신 둘의 카드에서만 3장 나온다 — 신 선택이 보상에 반영되는 지점 */
export const skipReward = "";
function rewardOffer(random: () => number, patrons: PatronPair): string[] {
  const candidates = cards.filter(({ patron }) => patron && patrons.includes(patron));
  // 후보가 셋보다 적으면 아래 루프가 영원히 돈다 — 멈추는 대신 왜 멈췄는지 말한다
  if (new Set(candidates.map(({ id }) => id)).size < 3) throw new Error(`${patrons.join("+")}: reward offer needs 3 cards`);
  const offer: string[] = [];
  while (offer.length < 3) {
    const { id } = candidates[Math.floor(random() * candidates.length)];
    if (!offer.includes(id)) offer.push(id);
  }
  return offer;
}

type EnemyData = {
  id: string;
  region: string;
  tier: "normal" | "boss";
  role: string;
  hp: number;
  passives?: Passives;
  pattern: { op: string; value?: number; token?: import("../core/state.ts").TokenName; stacks?: number; repeat?: number; target?: EnemyAction["target"] }[];
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
      stacks: effect.stacks,
      target: effect.target,
    })),
  };
}

/**
 * 조우는 지역이 아니라 `(층, 종류)`가 고른다 — `data/map.json`이 그 자리의 편성 후보를 갖는다.
 * 시드에 갈래가 섞여 있어야 같은 층의 두 `combat` 갈래가 다른 적을 뱉는다
 */
function encounter(seed: number, region: string, floor: number, type: MapNodeType): EnemyDefinition[] {
  if (type === "boss") {
    const bosses = enemyData.filter((enemy) => enemy.region === region && enemy.tier === "boss");
    const boss = bosses[seed % bosses.length];
    if (!boss) throw new Error(`${region}: no boss`);
    return [enemyDefinition(boss)];
  }
  const candidates = mapSlots.get(`${region}:${floor}`)?.groups[type === "elite" ? "elite" : "combat"] ?? [];
  if (!candidates.length) throw new Error(`${region} ${floor}: no ${type} group`);
  const groupId = candidates[seed % candidates.length];
  const root = enemyData.find((enemy) => enemy.groups?.some(({ id }) => id === groupId));
  const group = root?.groups?.find(({ id }) => id === groupId);
  if (!root || !group) throw new Error(`Unknown encounter group: ${groupId}`);
  return [root, ...group.with.map((id) => enemyData.find((enemy) => enemy.id === id)!)].map(enemyDefinition);
}

type EnemyView = { id: string; hp: number; maxHp: number; block: number; tokens: Tokens; passives: Passives; intent?: EnemyAction };
/** UI가 data/cards.json을 따로 읽으면 두 번째 진실이 된다 — 카드는 엔진이 준 것만 그린다 */
export type CardView = { id: string; name: string; cost: number; target: Card["target"]; effects: Card["effects"] };
const cardView = ({ id, name, cost, target, effects }: Card): CardView => ({ id, name, cost, target, effects });
const runView = (state: GameState, patrons: PatronPair): RunView => {
  const { region, floor } = mapSlot(state.map.depth);
  return { depth: state.map.depth, lane: state.map.lane, region, floor, hp: state.combat.player.hp, maxHp: state.combat.player.maxHp, patrons, grid: state.map.grid };
};
/**
 * 모든 관측이 공유한다. `patrons`는 런 내내 고정이고, 화면 머리글이 조합 이름을 여기서 읽는다.
 * 위치도 격자도 여기 있다 — UI가 시드로 `generateMap`을 다시 풀면 같은 사실에 두 경로가 생긴다
 */
export type RunView = { depth: number; lane: number; region: string; floor: number; hp: number; maxHp: number; patrons: PatronPair; grid: MapGrid };
export type CombatObservation = RunView & {
  turn: number;
  block: number;
  tokens: Tokens;
  energy: number;
  draw: number;
  hand: CardView[];
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
type DemandObservation = RunView & { patron: string; other: string; text: string; reward: number; penalty: number };
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

function* playEncounter(state: GameState, seed: number, deck: string[], cardMap: Map<string, Card>, enemies: EnemyDefinition[], log: string[], patrons: PatronPair, noise: () => number): Generator<Decision, EncounterResult, string> {
  const enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const random = createRng(seed);
  const hp = state.combat.player.hp;
  state.combat = createCombat(seed, deck, enemies);
  state.combat.player.hp = hp;
  applyFavorStageEffects(state, auraGods());
  const uses: FavorUses = {};
  let blockBuilt = 0;
  let blockAbsorbed = 0;
  const targetSpread: ("single" | "multi")[] = [];
  const cardsPlayed: string[] = [];
  const living = () => state.combat.enemies.filter(({ hp: enemyHp }) => enemyHp > 0);
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
    hand: state.combat.hand.map((id) => cardView(cardMap.get(id)!)),
    enemies: living().map((enemy) => {
      const pattern = enemyMap.get(enemy.id)!.pattern;
      // 패시브는 정의가 아니라 **상태**에서 온다 — `ward`·`guard`는 소모되므로 정의를 읽으면 화면이 안 움직인다
      const passives = Object.fromEntries(Object.entries(enemy.passives ?? {}).filter(([, stacks]) => stacks > 0));
      return { id: enemy.id, hp: enemy.hp, maxHp: enemy.maxHp, block: enemy.block, tokens: { ...enemy.tokens }, passives, intent: pattern[enemy.patternIndex % pattern.length] };
    }),
    hits,
    hitSeq,
  });

  while (state.combat.outcome === "ongoing") {
    startTurn(state, random);
    while (state.combat.outcome === "ongoing") {
      const affordable = state.combat.hand.filter((id) => (cardMap.get(id)?.cost ?? Infinity) <= state.combat.energy);
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
      const targets = card.target === "enemy" ? living().map(({ id }) => id) : [];
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

export function* runSteps(seed: number, scenario?: Scenario, patrons: PatronPair = ["zeus", "athena"]): Generator<Decision, RunResult, string> {
  const fusedCard = fusionCards.find(({ patronPair }) => patronPair?.every((god) => patrons.includes(god)));
  if (!fusedCard) throw new Error(`${patrons.join("+")}: no fused card for this pairing`);
  const startingDeck = [
    godDecks[patrons[0]][0], godDecks[patrons[0]][0], godDecks[patrons[0]][1], godDecks[patrons[0]][1], godDecks[patrons[0]][2],
    godDecks[patrons[1]][0], godDecks[patrons[1]][0], godDecks[patrons[1]][0], godDecks[patrons[1]][1], godDecks[patrons[1]][2],
  ];
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
  const restChoices: ("heal" | "remove")[] = [];
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
   * 판정해야 한다 — 수락은 약속이고, 보상은 지켰을 때만 들어간다
   */
  type DemandPromise = { demand: Demand; patron: GodId; other: GodId; answer: "accept" | "reject" };
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
    const answer = yield {
      phase: "demand",
      options: ["accept", "reject"],
      bot: chooseDemandAnswer(state.favor, patron, other),
      observation: { ...view(), patron, other, text: demand.text, reward: demandReward, penalty: demandPenalty(patron, other).amount },
    };
    if (answer !== "accept" && answer !== "reject") throw new Error(`Invalid demand action: ${answer}`);
    actions.push({ type: "demand", choice: answer });
    return { demand, patron, other, answer };
  }

  function* offerReward(nodeSeed: number): Generator<Decision, void, string> {
    // 전투/셔플과 겹치지 않는 새 스트림이다. 겹치면 기존 replay 재생이 깨진다
    const offer = rewardOffer(createRng(seed * 1000 + nodeSeed), patrons);
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
      const rest = yield {
        phase: "rest",
        options: ["heal", "remove"],
        bot: chooseRest(state.combat.player.hp, state.combat.player.maxHp),
        observation: mapObservation,
      };
      if (rest !== "heal" && rest !== "remove") throw new Error(`Invalid rest action: ${rest}`);
      const cardId = rest === "remove"
        ? yield {
          phase: "rest_card",
          options: [...deck],
          bot: chooseRestCard(deck, cardMap, state.combat),
          observation: mapObservation,
        }
        : undefined;
      takeRest(state, [...patrons], deck, rest, cardId);
      actions.push({ type: "rest", choice: rest });
      if (cardId !== undefined) actions.push({ type: "rest_card", choice: cardId });
      restChoices.push(rest);
      restCount += 1;
      advanceMap(state);
    } else {
      const enemies = encounter(seed + nodeSeed, region, floor, path);
      /** 이 조우가 무엇을 요구했는지. `--aura-matrix`가 개입의 부호를 여기서 갈라 읽는다 */
      const passives = [...new Set(enemies.flatMap(({ passives: own }) => Object.keys(own ?? {})))].sort();
      const devoted = patrons.filter((god) => favorStage(state.favor[god] ?? favorInitial) === "devotion");
      const promise = yield* askDemand(enemies.length, nodeSeed);
      const hpBefore = state.combat.player.hp;
      const result = yield* playEncounter(state, seed * 100 + nodeSeed, deck, cardMap, enemies, log, patrons, noise);
      turns += result.turns;
      blockBuilt += result.blockBuilt;
      blockAbsorbed += result.blockAbsorbed;
      targetSpread.push(...result.targetSpread);
      cardsPlayed.push(...result.cardsPlayed);
      enemyCounts.push(enemies.length);
      encounters += 1;
      // 편성 이름이 아니라 **자리**로 센다 — 층별 정책이 갈리는지 보려면 열이 층이어야 한다
      encounterOutcomes.push({ key: `${region}:${floor}:${path}`, cleared: state.combat.outcome === "victory", passives, devoted, hpLost: hpBefore - state.combat.player.hp });
      if (state.combat.outcome !== "victory") {
        defeatContext = { region, floor, enemies: enemies.map(({ id }) => id), passives };
        favorCurve.push({ ...state.favor });
        hpCurve.push(state.combat.player.hp);
        break;
      }
      // 전투 앞의 요구와 `omen`에서 걸어 둔 약속을 같은 사실로 판정한다
      for (const kept of [promise, carried]) {
        if (!kept) continue;
        // 지키지 못한 약속은 아무것도 움직이지 않는다 — 실패 벌금은 만들지 않는다 (R-5)
        const accept = kept.answer === "accept";
        const held = accept && demandSatisfied(kept.demand, result.facts);
        resolveDemand(state.favor, kept.patron, kept.other, held);
        demandSides.push(held ? kept.patron : kept.other);
        const [accepted, heldCount] = demandOutcomes[kept.demand.id] ?? [0, 0];
        demandOutcomes[kept.demand.id] = [accepted + (accept ? 1 : 0), heldCount + (held ? 1 : 0)];
      }
      carried = undefined;
      yield* offerReward(nodeSeed);
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
export function run(seed: number, scenario?: Scenario, scriptedActions: ReplayAction[] = [], patrons: PatronPair = ["zeus", "athena"]): RunResult {
  const steps = runSteps(seed, scenario, patrons);
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

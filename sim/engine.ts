import { createCombat, endTurn, playCard, startTurn, type EnemyAction, type EnemyDefinition } from "../core/combat.ts";
import { createRng } from "../core/rng.ts";
import cardDataJson from "../data/cards.json" with { type: "json" };
import demandDataJson from "../data/demands.json" with { type: "json" };
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import godDataJson from "../data/gods.json" with { type: "json" };
import { applyFavorStageEffects, awardGrace, demandReward, finishCombatFavor, recordCardFavor, type FavorGod, type FavorUses } from "../core/favor.ts";
import { demandPenalty, demandSatisfied, resolveDemand, type Demand } from "../core/demands.ts";
import { advanceMap, enemyDamageScale, mapNode, takeRest } from "../core/map.ts";
import { reduceCardCost, upgradeCard } from "../core/upgrade.ts";
import { canFuse } from "../core/fusion.ts";
import type { Card, GodId } from "../core/rules.ts";
import type { GameState, Passives, Tokens } from "../core/state.ts";
import { chooseCard, chooseDemandAnswer, chooseGraceCard, choosePath, chooseRest, chooseRestCard, chooseReward, chooseTarget } from "./bots/rule.ts";
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
/** 화면에는 `text`만 나간다 — `condition` DSL은 사람이 읽을 문장이 아니다 */
const demandData = demandDataJson as Demand[];

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

function encounter(seed: number, region: string, boss = false): EnemyDefinition[] {
  const candidates = enemyData.filter((enemy) => enemy.region === region && (enemy.tier === "boss") === boss);
  const root = candidates[seed % candidates.length];
  if (boss) return [enemyDefinition(root)];
  const group = root.groups![seed % root.groups!.length];
  return [root, ...group.with.map((id) => enemyData.find((enemy) => enemy.id === id)!)].map(enemyDefinition);
}

type EnemyView = { id: string; hp: number; maxHp: number; block: number; tokens: Tokens; passives: Passives; intent?: EnemyAction };
/** 이름·비용·효과는 은총 강화로 런 중에 바뀐다. UI가 data/cards.json을 따로 읽으면 두 번째 진실이 된다 */
export type CardView = { id: string; name: string; cost: number; target: Card["target"]; effects: Card["effects"] };
const cardView = ({ id, name, cost, target, effects }: Card): CardView => ({ id, name, cost, target, effects });
const runView = (state: GameState, patrons: PatronPair): RunView => {
  const { region, floor } = mapNode(state.map.node);
  return { node: state.map.node, region, floor, hp: state.combat.player.hp, maxHp: state.combat.player.maxHp, patrons };
};
/**
 * 모든 관측이 공유한다. `patrons`는 런 내내 고정이고, 화면 머리글이 조합 이름을 여기서 읽는다.
 * 위치도 여기 있다 — UI가 node로 mapNode를 다시 풀면 같은 사실에 두 경로가 생긴다
 */
export type RunView = { node: number; region: string; floor: number; hp: number; maxHp: number; patrons: PatronPair };
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
type MapObservation = RunView & { deck: CardView[] };
type RewardObservation = RunView & { deck: number; cards: CardView[] };
/** 마일스톤 2는 강화, 6은 비용 감소다. `cards`는 **덱에 있는** 그 신의 카드뿐이다 */
type GraceObservation = RunView & { god: string; milestone: number; cards: CardView[] };
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
  uses: FavorUses;
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
  applyFavorStageEffects(state, godData);
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
      blockBuilt += card.effects.reduce((sum, effect) => sum + (effect.op === "block" ? effect.value ?? 0 : 0), 0);
      targetSpread.push(card.target === "all_enemies" || card.effects.some(({ op }) => op === "chain") ? "multi" : "single");
      const beforeCard = healthBar();
      playCard(state, cardMap, cardId, target);
      recordHits(beforeCard, true);
      // 조건 없는 토큰만 센다 — `when`이 걸린 효과는 붙었는지 여기서 알 수 없으므로 세지 않는다
      const applied = card.effects.reduce((sum, effect) => sum + (effect.op === "apply_token" && !effect.when ? effect.stacks ?? 1 : 0), 0);
      facts.tokens_applied += applied;
      turnTokens += applied;
      if (card.patron) recordCardFavor(state.favor, card.patron, uses);
      log.push(`node=${state.map.node + 1} ${renderPlay(state.combat, card, target)}`);
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
  return { turns: state.combat.turn, blockBuilt, blockAbsorbed, targetSpread, uses, cardsPlayed, facts };
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
    grace: { [patrons[0]]: graced, [patrons[1]]: 0 },
    map: { node: 0, completed: [] },
  };
  const log: string[] = [];
  // ε 동전은 전투·셔플·보상과 겹치지 않는 스트림에서 뽑는다. 겹치면 ε을 켜는 것만으로 적 뽑기까지
  // 흔들려 두 열이 다른 게임이 된다. ε=0이면 아무도 당기지 않으므로 기존 replay는 그대로 재생된다
  const noise = createRng(seed ^ 0x5eed);
  const favorCurve = [{ ...state.favor }];
  const hpCurve = [state.combat.player.hp];
  const pathChoices: ("combat" | "rest")[] = [];
  const restChoices: ("heal" | "remove")[] = [];
  const regionsCleared: string[] = [];
  let encounters = 0;
  let restCount = 0;
  let turns = 0;
  let upgrades = 0;
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

  /** 덱에 없는 카드를 강화하면 아무 일도 일어나지 않는다. 그래서 후보는 덱 안의 그 신의 카드뿐이다 */
  function* grantMilestone(god: string, milestone: number): Generator<Decision, void, string> {
    const options = [...new Set(deck.filter((id) => cardMap.get(id)?.patron === god))];
    if (!options.length) return;
    const cardId = yield {
      phase: "grace",
      options,
      bot: chooseGraceCard(new Map(options.map((id) => [id, cardMap.get(id)!])), god, state.combat) ?? options[0],
      observation: { ...view(), god, milestone, cards: options.map((id) => cardView(cardMap.get(id)!)) },
    };
    if (!options.includes(cardId)) throw new Error(`Invalid grace action: ${cardId}`);
    if (milestone === 2) {
      cardMap.set(cardId, upgradeCard(cardMap.get(cardId)!));
      upgrades += 1;
    }
    if (milestone === 6) cardMap.set(cardId, reduceCardCost(cardMap.get(cardId)!));
    actions.push({ type: "grace", choice: cardId });
  }

  /**
   * 요구는 전투 **전에** 묻는다. 화면에 "셋을 쳐라"라고 띄웠으면 그 전투에서 정말 셋을 쳤는지로
   * 판정해야 한다 — 수락은 약속이고, 보상은 지켰을 때만 들어간다
   */
  type DemandPromise = { demand: Demand; patron: GodId; other: GodId; answer: "accept" | "reject" };
  function* askDemand(enemies: EnemyDefinition[]): Generator<Decision, DemandPromise | undefined, string> {
    if ((seed + state.map.node) % 5 >= 3) return undefined;
    const seekFusion = patrons.includes("artemis") && (state.grace[patrons[0]] ?? 0) >= 6;
    const demandIndex = seekFusion ? (seed + state.map.node) % 2 : 0;
    const patron = patrons[demandIndex];
    const other = patrons[1 - demandIndex];
    // 적이 둘뿐인 전투에 "셋을 쳐라"를 띄우면 지킬 수 없는 약속이다
    const asked = demandData.filter(({ patron: god, min_enemies }) => god === patron && min_enemies <= enemies.length);
    const demand = asked[(seed + state.map.node) % asked.length];
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

  function* offerReward(): Generator<Decision, void, string> {
    // 전투/셔플과 겹치지 않는 새 스트림이다. 겹치면 기존 replay 재생이 깨진다
    const offer = rewardOffer(createRng(seed * 1000 + state.map.node), patrons);
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

  if (graced >= 2) yield* grantMilestone(patrons[0], 2);
  if (graced >= 6) yield* grantMilestone(patrons[0], 6);

  while (state.map.node < 12 && state.combat.player.hp > 0) {
    const node = mapNode(state.map.node);
    const optional = node.options.includes("rest");
    const mapObservation: MapObservation = { ...view(), deck: deck.map((id) => cardView(cardMap.get(id)!)) };
    let path = node.options[0];
    if (optional) {
      const choice = yield {
        phase: "path",
        options: [...node.options],
        bot: choosePath(state.combat.player.hp, state.combat.player.maxHp),
        observation: mapObservation,
      };
      if (choice !== "combat" && choice !== "rest") throw new Error(`Invalid path action: ${choice}`);
      path = choice;
      pathChoices.push(choice);
      actions.push({ type: "path", choice });
    }
    if (path === "rest") {
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
      advanceMap(state, "rest");
    } else {
      const enemies = encounter(seed + state.map.node, node.region, path === "boss");
      const promise = yield* askDemand(enemies);
      const result = yield* playEncounter(state, seed * 100 + state.map.node, deck, cardMap, enemies, log, patrons, noise);
      turns += result.turns;
      blockBuilt += result.blockBuilt;
      blockAbsorbed += result.blockAbsorbed;
      targetSpread.push(...result.targetSpread);
      cardsPlayed.push(...result.cardsPlayed);
      enemyCounts.push(enemies.length);
      encounters += 1;
      encounterOutcomes.push({ key: enemies.map(({ id }) => id).join("+"), cleared: state.combat.outcome === "victory" });
      if (state.combat.outcome !== "victory") {
        defeatContext = {
          region: node.region,
          floor: node.floor,
          enemies: enemies.map(({ id }) => id),
          passives: [...new Set(enemies.flatMap(({ passives }) => Object.keys(passives ?? {})))].sort(),
        };
        favorCurve.push({ ...state.favor });
        hpCurve.push(state.combat.player.hp);
        break;
      }
      if (promise) {
        // 지키지 못한 약속은 아무것도 움직이지 않는다 — 실패 벌금은 만들지 않는다 (R-5)
        const accept = promise.answer === "accept";
        const kept = accept && demandSatisfied(promise.demand, result.facts);
        resolveDemand(state.favor, promise.patron, promise.other, kept);
        demandSides.push(kept ? promise.patron : promise.other);
        const [accepted, keptCount] = demandOutcomes[promise.demand.id] ?? [0, 0];
        demandOutcomes[promise.demand.id] = [accepted + (accept ? 1 : 0), keptCount + (kept ? 1 : 0)];
      }
      yield* offerReward();
      if (!fused && canFuse(state.favor, result.uses, patrons)) {
        deck.push(fusedCard.id);
        fused = true;
      }
      const god = awardGrace(state.favor, state.grace, [...patrons]);
      if (god && [2, 6].includes(state.grace[god])) yield* grantMilestone(god, state.grace[god]);
      advanceMap(state, path);
      if (node.floor === 6) regionsCleared.push(node.region);
    }
    favorCurve.push({ ...state.favor });
    hpCurve.push(state.combat.player.hp);
  }
  const won = state.map.node === 12 && state.combat.player.hp > 0;
  log.push(`outcome=${won ? "victory" : state.combat.outcome} encounters=${encounters} turns=${turns} hp=${state.combat.player.hp}`);
  // 런당 요구는 최대 아홉 번이다 — 최빈값을 세는 데 정렬 한 줄이면 된다
  const conflictChoice = [...demandSides].sort((left, right) =>
    demandSides.filter((god) => god === right).length - demandSides.filter((god) => god === left).length)[0];
  return { won, turns, log, favorCurve, encounters, restCount, hpCurve, pathChoices, restChoices, regionsCleared, grace: state.grace, upgrades, scenario, enemyCounts, encounterOutcomes, defeatContext, targetSpread, blockBuilt, blockAbsorbed, fused, actions, cardsPlayed, conflictChoice, demandOutcomes, pairing: patrons.join("+") };
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

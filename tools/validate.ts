import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_SLOTS } from "../core/combat.ts";
import { tierEnemies } from "../core/demands.ts";
import { godEnemyId } from "../core/favor.ts";
import { graceMilestones, graceSlots } from "../core/grace.ts";
import { floorsPerRegion } from "../core/map.ts";
import { enemyOnlyTokens, harmfulTokens, selfTokens } from "../core/rules.ts";
import { passiveNames, triggers, type Passives } from "../core/state.ts";
import { reachOk, reachSlots } from "../core/targeting.ts";
import { cardTier, expectedValue, graceBand, graceValue, isValueAllowed, mitigationTokens, mitigationValue, slotCards, tokenWeights } from "./value.ts";

export type FailureKey = "schema" | "dsl_parse" | "token_scope" | "fusion_scope" | "demand_axis" | "duplicate" | "value_outlier" | "pool_ratio" | "passive_coverage" | "map_layout" | "slot_scope";
type Item = Record<string, unknown>;
type Card = Item & { id: string; name: string; patron?: string; patron_pair?: string[]; cost: number; target: string; effects: Effect[]; tags: string[]; trigger?: string; reach?: string; tier?: number };
type Effect = { op: string; value?: number; token?: string; stacks?: number; when?: string; god?: string };
type DemandTier = { text: string; condition: string; cost?: Record<string, number>; reward: { favor?: number; grace?: number } };
type Demand = Item & { id: string; patron: string; axis: string; polarity: string; min_enemies: number; tiers: DemandTier[] };
/** 라이벌 반대편을 찾는 데 필요한 것만. 후보 하나로도 판정이 서야 하므로 베이스라인은 단을 들지 않는다 */
type DemandAxisOnly = { id: string; patron: string; axis: string; polarity: string };
type Enemy = Item & {
  id: string;
  /** 신 적에게는 없다 — 조우가 아니라 진노가 부른다 */
  region?: "underworld" | "surface";
  tier: "normal" | "boss" | "god";
  role: string;
  hp: number;
  pattern: (Effect & { repeat?: number; target?: string })[];
  passives?: Passives;
  /** `with`의 순서가 칸 1·2·3이고 `null`이 빈 칸이다 */
  groups?: { id: string; with: (string | null)[] }[];
};
type MapSlot = Item & { id: string; region: string; floor: number; text: string; groups: Partial<Record<"combat" | "elite", string[]>> };
type Grace = Item & { id: string; patron: string; slot: string; tier: number; text: string; effects: Effect[] };

const required: Record<string, string[]> = {
  card: ["id", "name", "cost", "target", "effects", "tags"],
  // `region`은 여기 없다 — 신 적은 지역을 갖지 않으므로 아래 `schemaFailure`가 tier와 함께 본다
  enemy: ["id", "name", "tier", "role", "hp", "intent_visible", "pattern", "pattern_mode"],
  demand: ["id", "patron", "tiers", "axis", "polarity", "min_enemies"],
  god: ["id", "name", "tokens", "ops", "rivals", "demands"],
  map: ["id", "region", "floor", "text", "groups"],
  grace: ["id", "patron", "slot", "tier", "text", "effects"],
};

const readData = <T>(name: string): T[] => {
  try { return JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8")) as T[]; }
  catch { return []; }
};
/**
 * 배포된 적과 층 배치. 편성의 세기는 적이 갖고 그 편성이 몇 층에 서는지는 지도가 갖는다 —
 * 한쪽만 넣고 게이트를 돌려도 밴드가 잴 수 있어야 하므로 gods.json과 같은 자리에서 읽는다
 */
const shippedEnemies = readData<Enemy>("enemies.json");
const shippedSlots = readData<MapSlot>("map.json");
/** 배포된 은혜. 신의 완화 비율은 카드와 은혜를 같이 봐야 한다 — 한쪽만 넣고 게이트를 돌려도 잴 수 있어야 한다 */
const shippedGraces = readData<Grace>("graces.json");
/** 은혜만 id가 tier 셋에 걸쳐 반복된다 — 같은 설계의 세 줄이다. 나머지는 id 하나가 항목 하나다 */
const itemKey = (item: Item): string => (kindOf(item) === "grace" ? `${item.id}:${item.tier}` : String(item.id));
const mergeById = <T extends Item>(shipped: T[], candidates: T[]): T[] =>
  [...new Map([...shipped, ...candidates].map((item) => [itemKey(item), item])).values()];

/** 신의 어휘는 data/gods.json이 정한다 — 게이트가 사본을 들면 데이터가 바뀔 때 조용히 어긋난다 */
type GodData = { id: string; tokens: string[]; ops: string[]; rivals: string[] };
const gods: Record<string, GodData> = Object.fromEntries(
  (JSON.parse(readFileSync(new URL("../data/gods.json", import.meta.url), "utf8")) as GodData[]).map((god) => [god.id, god]),
);
const commonOps = ["damage", "block", "draw", "energy", "heal", "self_damage", "apply_token", "favor_shift"];
const allTokens = Object.values(gods).flatMap(({ tokens }) => tokens);
const conditionPatterns = [
  /^favor\((patron|[a-z_]+)\) (>=|<) \d+$/,
  /^has_token\(target, [a-z_]+\) >= \d+$/,
  /^turn > \d+$/,
  /^hp_pct\(self\) < \d+$/,
  /^deck_count\([a-z_]+\) >= \d+$/,
  /^enemy_count\(\) >= \d+$/,
  /^slot\(target\) (>=|<) \d+$/,
];
const axes = ["target_spread", "damage_taken", "turn_economy", "token_load"];
const baselineCards: Card[] = [{
  id: "card_existing_strike",
  name: "기존 타격",
  patron: "ares",
  cost: 1,
  target: "enemy",
  effects: [{ op: "damage", value: 6 }],
  tags: ["attack"],
}];
const baselineDemands: DemandAxisOnly[] = [
  { id: "demand_zeus_multi", patron: "zeus", axis: "target_spread", polarity: "+" },
  { id: "demand_poseidon_solo", patron: "poseidon", axis: "target_spread", polarity: "-" },
  { id: "demand_athena_safe", patron: "athena", axis: "damage_taken", polarity: "-" },
  { id: "demand_ares_hurt", patron: "ares", axis: "damage_taken", polarity: "+" },
  { id: "demand_artemis_mark", patron: "artemis", axis: "token_load", polarity: "+" },
];

function kindOf(item: Item): string {
  const id = String(item.id ?? "");
  if (id.startsWith("card_")) return "card";
  if (id.startsWith("enemy_")) return "enemy";
  if (id.startsWith("demand_")) return "demand";
  if (id.startsWith("map_")) return "map";
  if (id.startsWith("grace_")) return "grace";
  if (gods[id]) return "god";
  return "unknown";
}

// ponytail: required keys plus the one cross-field rule the schema was buying us (patron XOR patron_pair).
function schemaFailure(item: Item, kind: string): boolean {
  if (!required[kind] || required[kind].some((key) => item[key] === undefined)) return true;
  // 키가 있어도 꼴이 틀릴 수 있다. 컨테이너를 먼저 재지 않으면 아래 규칙들이 반려가 아니라 **예외**를
  // 낸다 — 생성기가 뱉은 `null` 하나로 게이트가 죽으면 그 배치는 판정을 못 받는다
  if ((kind === "card" || kind === "grace") && !(Array.isArray(item.effects) && item.effects.length > 0)) return true;
  if (kind === "map" && (typeof item.groups !== "object" || item.groups === null || Array.isArray(item.groups))) return true;
  if (kind === "grace") {
    const grace = item as Grace;
    return !gods[grace.patron]
      || !(graceSlots as readonly string[]).includes(grace.slot)
      || !(graceMilestones as readonly number[]).includes(grace.tier)
      || grace.effects.some((effect) => typeof effect?.op !== "string");
  }
  /**
   * 신 적은 **지역이 없고 편성도 없다** — 조우가 아니라 진노가 부르고, 판에는 빈 칸으로 들어온다.
   * 지역을 적으면 지역 밴드가 그것을 편성으로 재려 하고, 편성을 적으면 아무도 안 쓰는 데이터가 된다
   */
  if (kind === "enemy") {
    const enemy = item as Enemy;
    if (!["normal", "boss", "god"].includes(enemy.tier)) return true;
    if ((enemy.tier === "god") === (enemy.region !== undefined)) return true;
    if (enemy.tier === "god" && enemy.groups !== undefined) return true;
    // 편성도 컨테이너다 — `null` 항목 하나면 `slotFailure`의 구조분해가 반려가 아니라 예외를 낸다
    if (enemy.groups !== undefined && (!Array.isArray(enemy.groups)
      || enemy.groups.some((group) => typeof group?.id !== "string" || !Array.isArray(group?.with)))) return true;
  }
  // 단은 **둘**이다 — 수락과 시련. 가운데를 끼우는 것은 두 단이 실제로 갈린 뒤의 일이다 (P-29)
  if (kind === "demand") {
    const demand = item as Demand;
    return !Array.isArray(demand.tiers) || demand.tiers.length !== 2
      || demand.tiers.some((tier) => typeof tier?.text !== "string" || typeof tier?.condition !== "string"
        || typeof tier?.reward !== "object" || tier.reward === null);
  }
  if (kind !== "card") return false;
  const card = item as Card;
  return Boolean(card.patron) === Boolean(card.patron_pair)
    // 없는 신을 적은 합성 카드는 `vocabularyUsed`가 `gods[god].ops`로 던진다 — 어휘부터 있어야 한다
    || (card.patron_pair !== undefined && (!Array.isArray(card.patron_pair) || card.patron_pair.length !== 2 || card.patron_pair.some((god) => !gods[god])))
    // tier는 1·2만 적는다. **융합에는 못 적는다** — `patron_pair`가 곧 3이라 두 곳에 적으면 어긋난다
    || (card.tier !== undefined && (![1, 2].includes(card.tier) || card.patron_pair !== undefined))
    || ![0, 1, 2, 3].includes(card.cost)
    || !["self", "enemy", "all_enemies"].includes(card.target)
    || card.effects.some((effect) => typeof effect?.op !== "string");
}

function dslFailure(card: Card): boolean {
  // 없는 훅을 적은 파워는 아무 트리거도 부르지 않고, 훅만 적힌 비파워 카드는 즉시 실행된다 — 둘 다 죽은 데이터다
  if (card.tags.includes("power") !== (card.trigger !== undefined)) return true;
  if (card.trigger !== undefined && !(triggers as readonly string[]).includes(card.trigger)) return true;
  if (card.reach !== undefined) {
    // 오름차순 0~3만. 규칙은 정규식 하나고 모양 표는 화면에만 있다
    if (!reachOk(card.reach)) return true;
    // `target: self` 카드에 적은 사거리는 아무도 읽지 않는다 — 죽은 데이터다
    if (card.target === "self") return true;
  }
  // 같은 이유로 자리 조건은 적을 가리켜야 한다 — 자기 대상 카드의 대상은 플레이어고 플레이어에게는 칸이 없다
  if (card.target === "self" && card.effects.some(({ when }) => when?.startsWith("slot(target)"))) return true;
  // 한 칸짜리 사거리에서는 연쇄가 닿을 곳이 없다 — `loadCards`가 낼 때 던지는 자리를 여기서 잡는다
  if (card.effects.some(({ op }) => op === "chain") && reachSlots(card.reach).length < 2) return true;
  return card.effects.some((effect) =>
    ![...commonOps, "chain"].includes(effect.op)
    || (effect.token !== undefined && !allTokens.includes(effect.token))
    || (effect.when !== undefined && !conditionPatterns.some((pattern) => pattern.test(effect.when!))),
  );
}

function vocabularyUsed(card: Card, god: string): boolean {
  return card.effects.some(({ op, token }) => gods[god].ops.includes(op) || (token !== undefined && gods[god].tokens.includes(token)));
}

function tokenScopeFailure(card: Card): boolean {
  const owners = card.patron_pair ?? (card.patron ? [card.patron] : []);
  return card.effects.some(({ op, token }) =>
    (op === "chain" && (card.target !== "enemy" || !owners.includes("zeus")))
    || (token !== undefined && !owners.some((god) => gods[god]?.tokens.includes(token)))
    // target=self인 카드가 적 토큰을 붙이면 그 디버프는 플레이어에게 간다. 기대값 표는 그것을 이득으로 센다
    || (op === "apply_token" && card.target === "self" && token !== undefined && !(selfTokens as ReadonlySet<string>).has(token)),
  );
}

/**
 * 은혜는 카드의 `target`을 탄다 — 자기 `target`을 갖지 않는다. 그래서 **적을 향하는 효과는 `attack`
 * 슬롯만** 쓸 수 있다: 방어·유틸·토큰 슬롯에는 `target: self` 카드가 각각 30·34·11장 있고, 거기
 * 붙은 `damage`와 해로운 토큰은 `executeCard`가 **플레이어에게** 돌린다(픽스처 09와 같은 자리다).
 *
 * `chain`도 막는다 — `loadCards`가 대상 enemy를 요구하므로 광역 공격 카드에 붙으면 낼 때마다 던진다
 */
function graceScopeFailure(grace: Grace): boolean {
  const vocabulary = gods[grace.patron];
  return grace.effects.some(({ op, token }) =>
    !commonOps.includes(op)
    || (token !== undefined && !vocabulary.tokens.includes(token))
    || (grace.slot !== "attack" && (op === "damage" || (token !== undefined && (harmfulTokens as ReadonlySet<string>).has(token)))));
}

/** 은혜를 신의 풀에 얹을 때 쓰는 카드 꼴. 효과값에 슬롯 장수를 곱해 두므로 `expectedValue`가 곧 환산값이다 */
const graceAsCard = (grace: Grace): Card => {
  const cards = slotCards[grace.slot] ?? 0;
  const scale = (amount?: number) => (amount === undefined ? undefined : amount * cards);
  return {
    id: grace.id,
    name: grace.id,
    patron: grace.patron,
    cost: 1,
    target: "enemy",
    tags: [],
    effects: grace.effects.map((effect) => ({ ...effect, value: scale(effect.value), stacks: scale(effect.stacks) })),
  };
};

function fusionFailure(card: Card): boolean {
  if (!card.patron_pair) return false;
  const sorted = [...card.patron_pair].sort();
  return sorted.some((god, index) => god !== card.patron_pair![index])
    || card.tags.includes("exhaust")
    || card.patron_pair.some((god) => !vocabularyUsed(card, god));
}

/** 선불 대가가 쓸 수 있는 것. 새 기제는 안 만든다 — 넷 다 이미 있는 경로다 (P-29 §대가) */
const costFields = ["favor", "maxHp", "encounters"] as const;
/**
 * 보상의 서열은 **어휘 하나**다 — 은혜가 호의보다 크다(P-28 실측: 은혜 효과만 끄면 승률 0.563 → 0.294).
 * 두 값을 한 숫자로 섞는 상수를 만들지 않고 (은혜, 호의) 사전식으로 잰다
 */
const rewardRises = (easy: DemandTier["reward"], trial: DemandTier["reward"]): boolean => {
  const [low, high] = [easy.grace ?? 0, trial.grace ?? 0];
  return high > low || (high === low && (trial.favor ?? 0) > (easy.favor ?? 0));
};

/**
 * 2단 요구의 규칙 셋. 전부 **순서**만 잰다 — 호의·최대 체력·은혜를 한 눈금으로 바꾸는 상수가 곧
 * 두 번째 눈금이고(R-28이 `energy`를 어휘에서 뺀 것과 같은 이유), 「시련이 항상 손해인가」는
 * 2000런의 선택 분포가 이미 잡는다
 */
function demandFailure(demand: Demand, demands: DemandAxisOnly[]): boolean {
  if (!axes.includes(demand.axis)) return true;
  const parsed = demand.tiers.map(({ condition }) => condition.match(/^([a-z_]+) (>=|<=|>|==) (\d+)$/));
  if (parsed.some((match) => !match)) return true;
  const [easy, trial] = parsed as RegExpMatchArray[];
  // 두 단이 다른 사실을 재면 임계 단조가 뜻을 잃는다 — 요구 하나의 축은 하나다
  if (easy[1] !== trial[1]) return true;
  // 1 · 임계 단조: polarity `-`면 내려가고 `+`면 올라간다. 같으면 두 단이 같은 요구다
  const [low, high] = [Number(easy[3]), Number(trial[3])];
  if (demand.polarity === "-" ? high >= low : high <= low) return true;
  // 2 · 보상 단조: 쉬운 단이 더 주면 시련을 아무도 안 고른다
  if (!rewardRises(demand.tiers[0].reward, demand.tiers[1].reward)) return true;
  // 3 · 대가 단조: 시련이 더 싸면 시련이 아니다. 필드마다 오르고 어딘가는 실제로 커야 한다
  const [cheap, dear] = demand.tiers.map(({ cost }) => cost ?? {});
  if (costFields.some((key) => (dear[key] ?? 0) < (cheap[key] ?? 0))) return true;
  if (!costFields.some((key) => (dear[key] ?? 0) > (cheap[key] ?? 0))) return true;
  // 기간 없는 최대 체력 대가는 조우 하나도 못 살고 걷힌다 — 죽은 데이터다
  if (demand.tiers.some(({ cost }) => cost?.maxHp && !(cost.encounters >= 1))) return true;
  // 축이 요구하는 적 수. 쉬운 단이 곧 이 요구가 설 수 있는 조우 크기다 — 어려운 단은 `askDemand`가 가린다
  if (Math.min(...demand.tiers.map(({ condition }) => tierEnemies(condition, demand.min_enemies))) !== demand.min_enemies) return true;
  const rivals = gods[demand.patron]?.rivals ?? [];
  return rivals.length > 0 && !demands.some((other) =>
    rivals.includes(other.patron) && other.axis === demand.axis && other.polarity !== demand.polarity,
  );
}

function fingerprint(card: Card): string {
  return card.effects.map(({ op, value, stacks }) => `${op}:${Math.floor((value ?? stacks ?? 0) / 3)}`).join("|");
}

function duplicateFailure(card: Card, existing: Card[]): boolean {
  return existing.some((other) => fingerprint(card) === fingerprint(other) || card.name === other.name);
}

type StageEffect = Effect & { target: string };
type StageHooks = { on_encounter_start?: StageEffect[]; on_turn_start?: StageEffect[] };
const stageTargets = ["self", "enemy", "all_enemies"];
const stageHooks = (god: Item) => Object.entries((god.stage_effects ?? {}) as Record<string, StageHooks>);
const stageEffects = (god: Item, stage?: string): StageEffect[] =>
  stageHooks(god).flatMap(([name, hook]) => (stage === undefined || name === stage ? [...hook.on_encounter_start ?? [], ...hook.on_turn_start ?? []] : []));
/** 매 턴 훅에서 그 턴 안에 사라지는 토큰. 감전은 적 턴 끝에 지워진다(`core/combat.ts:152`) */
const turnSafeTokens = new Set(["shock"]);
/**
 * 개입만 쓰는 op. `commonOps`에 넣으면 카드도 쓸 수 있게 되는데 `executeCard`에는 분기가 없어
 * 조용히 아무 일도 안 하는 효과가 된다 — 그것이 §0의 부채였다
 */
const stageOnlyOps = ["join"];

function stageEffectScopeFailure(god: Item): boolean {
  const definition = gods[String(god.id)];
  // 매 턴 훅은 조우 내내 쌓이는 것을 못 든다 — 5.8턴 × 12조우면 지속 토큰이 60스택이고, 적 방어는
  // 리셋이 없어(`core/combat.ts:73`은 플레이어만 지운다) 벽이 된다. 밸런스가 아니라 고장이다
  const turnAccumulates = stageHooks(god).flatMap(([, hook]) => hook.on_turn_start ?? [])
    .some(({ op, token, target }) => (token !== undefined && !turnSafeTokens.has(token)) || (op === "block" && target !== "self"));
  return turnAccumulates || stageEffects(god).some(({ op, token, target, god: joined }) =>
    (!commonOps.includes(op) && !stageOnlyOps.includes(op) && !definition.ops.includes(op))
    // 합류는 배포된 `tier: "god"` 적을 가리켜야 한다 — 없으면 `admitPending`이 조우 중에 던진다
    || (op === "join" && !shippedEnemies.some(({ id, tier }) => tier === "god" && id === godEnemyId(joined ?? "")))
    || (token !== undefined && !definition.tokens.includes(token))
    // 오타 하나면 `targets()`가 조용히 전 적군으로 읽는다 — 죽은 데이터가 아니라 **다른** 데이터가 된다
    || !stageTargets.includes(target)
    // 소모 경로가 적 턴뿐인 토큰을 플레이어에게 붙이면 영원히 안 지워지고 아무 일도 안 한다 (§0의 부채)
    || (target === "self" && token !== undefined && (enemyOnlyTokens as ReadonlySet<string>).has(token))
    // 자기에게 향한 피해는 `dealDamage(player, player)`가 되고, 그러면 `deflect`를 태우고 피해는 그대로
    // 먹는다 — 죽은 개입이 아니라 **뒤집힌** 개입이다. 진노가 때리려면 적 능력을 키우는 쪽을 쓴다
    || (target === "self" && op === "damage"),
  );
}

/**
 * 개입이 플레이어를 돕는 쪽에 떨어졌는가. `tokenWeights`는 「제자리에 붙은 토큰」의 무게라 부호가
 * 없다 — 적에게 간 이로운 토큰과 나에게 붙은 해로운 토큰은 같은 무게로 **손해**다
 */
const helpsPlayer = ({ op, token }: Effect, target: string): boolean => {
  const self = target === "self";
  if (op === "apply_token") return self === (selfTokens as ReadonlySet<string>).has(token ?? "");
  return op === "damage" ? !self : self;
};

/**
 * 헌신 개입은 **그 자체로** 순이득이어야 한다. 나쁜 결과는 적 능력과 만났을 때만 나와야 하고,
 * 효과에 페널티를 섞으면 「신의 변덕」이 아니라 그냥 비용이 된다 — 플레이어는 계산기를 두드리면 끝이다
 */
function stageValueFailure(god: Item): boolean {
  const effects = stageEffects(god, "devotion");
  if (!effects.length) return false;
  const value = effects.reduce((sum, effect) => sum
    + expectedValue({ cost: 1, target: effect.target, effects: [effect], tags: [] }) * (helpsPlayer(effect, effect.target) ? 1 : -1), 0);
  return value <= 0;
}

/** 「한 대」의 크기. `guard`가 스택마다 아군 대신 한 대를 받는다 — 배포된 82개 damage 효과의 중앙값 */
const medianCardDamage = 6;
/** 적 행동의 대상이 자기편인가. 없으면 피해·토큰은 플레이어를 향한다(`core/combat.ts`의 기본값과 같다) */
const friendly = (effect: { target?: string }) => effect.target !== undefined && effect.target !== "player";

/**
 * 세기 환산은 `tools/value.ts`의 `tokenWeights`를 그대로 읽는다 — **두 번째 눈금을 만들지 않는다.**
 * 다만 자기편에게 붙는 완화 토큰은 흡수량이 곧 체력이라 스택 수를 그대로 쓴다(가중치 2.5는 카드가
 * 사는 지속 프리미엄이지 흡수량이 아니다). 방어·회복도 플레이어가 더 써야 하는 피해라 같은 쪽이다
 */
const effectiveHp = (member: Enemy) => member.hp
  + member.pattern.reduce((total, effect) => total
    + (effect.op === "block" || effect.op === "heal" ? effect.value ?? 0 : 0)
    + (effect.op === "apply_token" && friendly(effect) && mitigationTokens.has(effect.token ?? "") ? effect.stacks ?? 1 : 0), 0)
  // 반응형 패시브 셋만 실효 체력이다. `angry`·`rally`·`spite`는 플레이어가 무엇을 하느냐에 달려
  // 보장된 값이 없으므로 세지 않는다 — 세면 조우 밴드가 일어나지 않은 일을 세게 된다
  + (member.passives?.curl ?? 0)
  + (member.passives?.shell ?? 0)
  + (member.passives?.guard ?? 0) * medianCardDamage;
const intent = (member: Enemy) => member.pattern.reduce((total, effect) => total
  + (effect.op === "damage" ? (effect.value ?? 0) * (effect.repeat ?? 1) : 0)
  + (effect.op === "apply_token" && !(friendly(effect) && mitigationTokens.has(effect.token ?? "")) ? (tokenWeights[effect.token ?? ""] ?? 0) * (effect.stacks ?? 1) : 0), 0) / member.pattern.length
  // ramp는 매 턴 확정으로 쌓이므로 패턴이 아니라 여기에 더한다
  + (member.passives?.ramp ?? 0) * tokenWeights.frenzy;

/**
 * 자리가 역할을 정한다. **런타임 보정이 아니라 배치 규칙이다** — 칸 0·1에 방어 +N을 얹으면 배포된
 * 편성 전부가 재측정 대상이 되고, 어느 값이 적의 것이고 어느 값이 자리의 것인지 화면에서 못 읽는다.
 * 역할이 이미 그 성격을 들고 있으므로 게이트가 어긋난 편성을 반려한다.
 *
 * 뿌리가 칸 0이라 **뒷줄 역할은 편성을 소유할 수 없다** — 혼자 서는 뒷줄 적은 앞칸에 서는 셈이다
 */
const roleSlots: Record<string, number[]> = {
  guardian: [0, 1], attrition: [0, 1], brute: [0, 1], swarm: [0, 1],
  pressure: [2, 3], applier: [2, 3], support: [2, 3], zealot: [2, 3],
  boss: [0, 1, 2, 3], god: [0, 1, 2, 3],
};

function slotFailure(enemy: Enemy, enemies: Enemy[]): boolean {
  return (enemy.groups ?? []).some(({ with: rest }) => {
    if (!Array.isArray(rest) || rest.length > MAX_SLOTS - 1) return true;
    return [enemy.id, ...rest].some((id, slot) => {
      if (id === null) return false;
      const member = enemies.find((candidate) => candidate.id === id);
      // 없는 id는 `groupStrength`가 `value_outlier`로 잡는다 — 여기서는 자리만 본다
      return member !== undefined && !(roleSlots[member.role] ?? []).includes(slot);
    });
  });
}

type Strength = { hp: number; damage: number; count: number };
function groupStrength(groupId: string, enemies: Enemy[]): Strength | undefined {
  const root = enemies.find((enemy) => enemy.groups?.some((group) => group.id === groupId));
  const group = root?.groups?.find(({ id }) => id === groupId);
  if (!root || !group) return undefined;
  // 빈 칸은 세지 않는다 — 세기는 사람 수고 자리는 `slotFailure`가 본다
  const members = [root, ...group.with.filter((id) => id !== null).map((id) => enemies.find((enemy) => enemy.id === id))];
  if (members.some((member) => !member)) return undefined;
  const complete = members as Enemy[];
  return {
    hp: complete.reduce((total, member) => total + effectiveHp(member), 0),
    damage: complete.reduce((total, member) => total + intent(member), 0),
    count: complete.length,
  };
}

/**
 * 지상 `count` 상한이 3 → **4**다(P-35 §6) — 4인 편성은 그 전까지 사람 수에서 반려됐다.
 * `hp` 상한도 170 → **200**을 한 번 올렸다: 앞칸 둘(실효 체력 115)만으로 이미 170에 붙어
 * 4인 편성이 어떤 값으로도 못 서고, 밴드를 새로 만들지 않는 유일한 길이 상한을 옮기는 것이었다
 */
const regionBands: Record<string, Record<"hp" | "damage" | "count", [number, number]>> = {
  underworld: { hp: [40, 90], damage: [8, 14], count: [1, 2] },
  surface: { hp: [90, 200], damage: [14, 22], count: [2, 4] },
};
/** 전투가 서는 층 수. 6층은 보스라 진행 함수 밖이다 */
const combatFloors = floorsPerRegion - 1;
/**
 * 층 진행 함수. 상한이 1층에서 지역 밴드의 절반, 5층에서 상한에 닿는다 — 지역 안에서 선형이다.
 * 하한은 지역 밴드 그대로다: 배포된 저승 편성이 실효 체력 40~87에 몰려 있어 하한까지 같이 끌면
 * 2층에 놓을 편성이 하나도 없다. **밴드를 옮기지 않고** 잡을 수 있는 것은 「그 층에 너무 센 편성」이다.
 * `count`도 기울이지 않는다 — 지역마다 값이 둘뿐이라 다섯 층에 걸친 기울기가 정수로 안 떨어진다
 */
const floorCeiling = (band: [number, number], floor: number) =>
  band[0] + (band[1] - band[0]) * (0.5 + (floor - 1) / (2 * (combatFloors - 1)));
/** 정예 상한. 하한은 같은 층 `combat` 편성의 실측 최대다 — 「보상이 큰 이유」가 층마다 실제로 있어야 한다 */
export const eliteScale = 1.3;

/**
 * 편성이 **지역** 밴드 안에 있는가. 층 진행 상한은 `mapSlotFailure`가 본다 — 두 층이다:
 * 지역 밴드는 편성 자체의 계약이고 층 상한은 그 편성을 어디에 놓을지의 계약이다
 */
function encounterThresholdFailure(enemy: Enemy, enemies: Enemy[]): boolean {
  // 신 적은 편성이 아니다 — 진노가 아무 조우에나 얹으므로 잴 지역 밴드가 없다(R-30의 남긴 자리)
  if (enemy.tier === "god") return false;
  if (enemy.tier === "boss") return enemy.hp !== (enemy.region === "underworld" ? 130 : 190) || enemy.groups !== undefined;
  /**
   * 편성을 하나도 소유하지 않는 적. **뒷줄 역할은 소유할 수 없다** — 뿌리가 칸 0이라 `pressure`·
   * `zealot`·`applier`·`support`는 남의 편성에만 이름이 오른다. 거기에도 없으면 아무도 안 쓰는 데이터다
   */
  if (!enemy.groups?.length) {
    return !enemies.some(({ groups }) => (groups ?? []).some(({ with: rest }) => rest.includes(enemy.id)));
  }
  const band = regionBands[enemy.region!];
  return enemy.groups.some(({ id }) => {
    const strength = groupStrength(id, enemies);
    if (!strength) return true;
    return (["hp", "damage", "count"] as const).some((key) => strength[key] < band[key][0] || strength[key] > band[key][1]);
  });
}

function mapSlotFailure(slot: MapSlot, enemies: Enemy[]): FailureKey | undefined {
  const band = regionBands[slot.region];
  const { floor, groups } = slot;
  if (!band || !Number.isInteger(floor) || floor < 1 || floor > floorsPerRegion) return "map_layout";
  const boss = floor === floorsPerRegion;
  // 보스 층은 편성을 적지 않는다 — 적의 `tier`가 정한다. 나머지 층은 `combat`이 반드시 있다
  if (boss !== (Object.keys(groups).length === 0)) return "map_layout";
  if (!boss && !groups.combat?.length) return "map_layout";
  /**
   * 정예는 3층부터(StS의 「6층 아래 금지」를 6층짜리로 축소), 그리고 **5층에는 놓일 수 없다** —
   * 4층의 정예·휴식과 5층의 휴식 보장이 「이어진 칸 금지」에서 부딧혀 격자가 5층에 정예를 못 놓는다.
   * 적어 두면 아무도 안 쓰는 데이터가 된다
   */
  if (groups.elite?.length && (floor < 3 || floor > floorsPerRegion - 2)) return "map_layout";
  const strengths = (["combat", "elite"] as const).map((kind) => (groups[kind] ?? []).map((id) => groupStrength(id, enemies)));
  if (strengths.flat().some((strength) => !strength)) return "map_layout";
  const [combat, elite] = strengths as [Strength[], Strength[]];
  const outside = ({ hp, damage, count }: Strength, scale: number) =>
    hp < band.hp[0] || hp > floorCeiling(band.hp, floor) * scale
    || damage < band.damage[0] || damage > floorCeiling(band.damage, floor) * scale
    || count < band.count[0] || count > band.count[1];
  if (combat.some((strength) => outside(strength, 1))) return "value_outlier";
  // 정예는 같은 층 `combat` 최대보다 세다 — 둘 다 밀리지 않고 하나는 넘어야 한다
  const most = (key: "hp" | "damage") => Math.max(...combat.map((strength) => strength[key]));
  return elite.some((strength) => outside(strength, eliteScale)
    || strength.hp < most("hp") || strength.damage < most("damage")
    || (strength.hp === most("hp") && strength.damage === most("damage")))
    ? "value_outlier"
    : undefined;
}

/**
 * 카드 한 장이 아니라 신 하나의 풀을 잰다. 4~8 밴드는 한 신이 그 값을 전부 완화에 써도 통과시키는데,
 * 7~15턴 전투에서는 같은 기대값을 완화에 쓰는 쪽이 공격에 쓰는 쪽보다 승률로 더 잘 바뀐다.
 * 아테나가 그 자리였다 — 완화 비율 0.57에 조합 평균 승률 0.70.
 */
export const poolRatioMax = 0.3;
/**
 * R1만 걸면 아테나는 완화를 공격으로 옮겨 통과하면서 **더 강해진다**(실측 0.478, 배포 조합 0.755).
 * 이 상한이 그 출구를 막는다. 하한은 두지 않는다 — 포세이돈이 장당 기대값 최저(4.94)인데 승률 2위라
 * 장당 기대값은 세기를 예측하지 못한다. 5.5는 아테나를 뺀 최고값(아르테미스 5.35) 바로 위다.
 *
 * **tier마다 다른 평균이다** — 값의 계단이 곧 tier이므로 한 평균으로 섞으면 tier2 세 장이 그 신의
 * 장당 기대값을 통째로 밀어 올린다. tier2 상한 9.0은 밴드 `[8, 10)`의 가운데고, 세 장뿐인 풀의
 * 평균이므로 상한이 곧 「세 장 다 최고값은 안 된다」다. **완화 비율은 갈리지 않는다**: 완화는 신의
 * 성격이지 등급이 아니고, 가르면 세 장으로 재는 비율이 되어 잡음만 커진다 (P-39)
 */
export const poolValueMax: Record<number, number> = { 1: 5.5, 2: 9 };
export type PoolStat = { cards: number; value: number; mitigation: number; ratio: number; average: number };

export function poolStat(pool: Card[]): PoolStat {
  const value = pool.reduce((sum, card) => sum + expectedValue(card), 0);
  const mitigation = pool.reduce((sum, card) => sum + mitigationValue(card), 0);
  return { cards: pool.length, value, mitigation, ratio: mitigation / value, average: value / pool.length };
}

const worstBy = (pool: Card[], score: (card: Card) => number) => pool.reduce((left, right) => (score(left) >= score(right) ? left : right));
/**
 * 완화 비율에 합산할 은혜의 tier. 한 신이 한 번에 드는 것은 **한 tier 세 줄**이므로 셋을 다 세면
 * 세 배로 센다 — 가운데를 쓴다
 */
const graceRatioTier = 4;

function poolRejects(cards: Card[], graces: Grace[]): Set<string> {
  const rejects = new Set<string>();
  for (const god of Object.keys(gods)) {
    // 합성 카드는 밴드가 tier3이고 신이 아니라 조합에 속한다 — 신의 풀에서 뺀다
    let pool = cards.filter((card) => card.patron === god);
    /**
     * 은혜도 완화 비율에 들어간다 — P-22의 상한(0.30)이 카드 풀에만 걸려 있으면 신이 완화를 은혜로
     * 옮겨 통과하면서 더 강해진다(R-22의 아테나가 그 자리였다). 장당 기대값 평균에는 넣지 않는다:
     * 은혜는 장수가 아니라 슬롯 하나라 평균의 분모가 아니다
     */
    let boons = graces.filter((grace) => grace.patron === god && grace.tier === graceRatioTier).map(graceAsCard);
    // 신당 24~33장이다. 10장 미만은 풀이 아니라 후보 묶음이므로 재지 않는다
    if (pool.length < 10) continue;
    // ponytail: 위반을 만든 카드를 하나씩 걷어낸다. O(n²)지만 신당 30장이다
    while (pool.length > 1) {
      const { ratio } = poolStat([...pool, ...boons]);
      // 장당 기대값은 tier마다 잰다 — 상한을 넘긴 칸에서 가장 센 카드를 걷어낸다
      const heavy = Object.entries(poolValueMax)
        .map(([tier, cap]) => [pool.filter((card) => cardTier(card) === Number(tier)), cap] as const)
        .find(([step, cap]) => step.length > 0 && poolStat(step).average > cap)?.[0];
      const worst = ratio > poolRatioMax ? worstBy([...pool, ...boons], mitigationValue)
        : heavy ? worstBy(heavy, expectedValue)
        : undefined;
      if (!worst) break;
      rejects.add(worst.id);
      pool = pool.filter(({ id }) => id !== worst.id);
      boons = boons.filter(({ id }) => id !== worst.id);
    }
  }
  return rejects;
}

/** 없는 이름을 적은 패시브는 어떤 훅도 읽지 않는다 — 오타 하나가 곧 죽은 코드다 */
function passiveFailure(enemy: Enemy): boolean {
  return Object.entries(enemy.passives ?? {}).some(([name, stacks]) =>
    !(passiveNames as readonly string[]).includes(name) || !Number.isInteger(stacks) || (stacks as number) <= 0);
}

function failureFor(item: Item, cards: Card[], demands: DemandAxisOnly[], enemies: Enemy[]): FailureKey | undefined {
  const kind = kindOf(item);
  if (schemaFailure(item, kind)) return "schema";
  if (kind === "card") {
    const card = item as Card;
    if (dslFailure(card)) return "dsl_parse";
    if (tokenScopeFailure(card)) return "token_scope";
    if (fusionFailure(card)) return "fusion_scope";
    if (duplicateFailure(card, cards)) return "duplicate";
    if (!isValueAllowed(card)) return "value_outlier";
  }
  if (kind === "demand" && demandFailure(item as Demand, demands)) return "demand_axis";
  if (kind === "god" && stageEffectScopeFailure(item)) return "token_scope";
  if (kind === "god" && stageValueFailure(item)) return "value_outlier";
  if (kind === "enemy" && passiveFailure(item as Enemy)) return "passive_coverage";
  if (kind === "enemy" && slotFailure(item as Enemy, enemies)) return "slot_scope";
  if (kind === "enemy" && encounterThresholdFailure(item as Enemy, enemies)) return "value_outlier";
  if (kind === "map") return mapSlotFailure(item as MapSlot, enemies);
  if (kind === "grace") {
    const grace = item as Grace;
    if (graceScopeFailure(grace)) return "token_scope";
    const [low, high] = graceBand(grace.tier);
    const value = graceValue(grace.effects, slotCards[grace.slot] ?? 0);
    if (value < low || value > high) return "value_outlier";
  }
  return undefined;
}

export function validateItems(items: Item[], basePool: Card[] = []): { accepted: Item[]; rejected: { id: string; failure: FailureKey }[]; pass_rate: number; by_pairing: Record<string, number>; failure_breakdown: Partial<Record<FailureKey, number>>; pools: Record<string, PoolStat>; passive_coverage: string[]; unplaced_groups: string[]; grace_coverage: string[] } {
  const accepted: Item[] = [];
  const rejected: { id: string; failure: FailureKey }[] = [];
  const failure_breakdown: Partial<Record<FailureKey, number>> = {};
  const cards = [...baselineCards];
  const demands = [...baselineDemands, ...items.filter((item) => kindOf(item) === "demand") as Demand[]];
  const enemies = mergeById(shippedEnemies, items.filter((item) => kindOf(item) === "enemy") as Enemy[]);

  for (const item of items) {
    const failure = failureFor(item, cards, demands, enemies);
    if (failure) {
      rejected.push({ id: String(item.id), failure });
      failure_breakdown[failure] = (failure_breakdown[failure] ?? 0) + 1;
    } else {
      accepted.push(item);
      if (kindOf(item) === "card") cards.push(item as Card);
    }
  }
  // 풀 규칙은 신 단위라 항목 하나로는 판정이 안 된다 — 개별 통과분을 다 모은 뒤에 잰다
  const reject = (item: Item, failure: FailureKey) => {
    accepted.splice(accepted.indexOf(item), 1);
    rejected.push({ id: String(item.id), failure });
    failure_breakdown[failure] = (failure_breakdown[failure] ?? 0) + 1;
  };
  const overflow = poolRejects([...basePool, ...accepted.filter((item) => kindOf(item) === "card") as Card[]],
    mergeById(shippedGraces, accepted.filter((item) => kindOf(item) === "grace") as Grace[]));
  for (const item of [...accepted]) if (overflow.has(String(item.id))) reject(item, "pool_ratio");
  /**
   * 층 배치는 편성을 **이름으로** 참조한다. 반려된 적이 지도를 통과시키면 `--apply`가 배포되지 않을
   * 편성을 가리키는 층을 쓰고, 그 자리는 런타임에서 `encounter()`가 던진다 — `pool_ratio`와 같은
   * 자리다: 통과분이 다 모인 뒤에 **통과한 적만으로** 다시 잰다
   */
  const liveEnemies = mergeById(shippedEnemies, accepted.filter((item) => kindOf(item) === "enemy") as Enemy[]);
  for (const item of [...accepted]) {
    if (kindOf(item) !== "map") continue;
    const failure = mapSlotFailure(item as MapSlot, liveEnemies);
    if (failure) reject(item, failure);
  }
  const graces = mergeById(shippedGraces, accepted.filter((item) => kindOf(item) === "grace") as Grace[]);
  const survivors = [...basePool, ...accepted.filter((item) => kindOf(item) === "card") as Card[]];
  /**
   * 행이 `신:tier`다 — 장당 기대값 상한이 tier마다 다르므로 한 행으로 섞으면 어느 칸이 상한에 붙었는지
   * 안 보인다. `ratio`는 tier로 갈리지 않으니 두 행에 같은 값(그 신의 풀 전체)이 든다
   */
  const pools = Object.fromEntries(Object.keys(gods).flatMap((god) => {
    const owned = survivors.filter((card) => card.patron === god);
    return Object.keys(poolValueMax).flatMap((tier) => {
      const step = owned.filter((card) => cardTier(card) === Number(tier));
      return step.length > 0 ? [[`${god}:${tier}`, { ...poolStat(step), ratio: poolStat(owned).ratio }] as const] : [];
    });
  }));

  const fusionItems = items.filter((item) => Array.isArray(item.patron_pair));
  const by_pairing = Object.fromEntries([...new Set(fusionItems.map((item) => (item.patron_pair as string[]).join("+")))].map((pairing) => {
    const total = fusionItems.filter((item) => (item.patron_pair as string[]).join("+") === pairing).length;
    const passed = accepted.filter((item) => Array.isArray(item.patron_pair) && (item.patron_pair as string[]).join("+") === pairing).length;
    return [pairing, passed / total];
  }));
  /**
   * 어느 적에게도 붙지 않은 패시브. 항목 하나로는 판정이 안 되는 데이터셋 규칙이라 `pool_ratio`와
   * 같은 자리에 선다 — 다만 탓할 항목이 없으므로 반려가 아니라 목록으로 낸다. 비어 있지 않으면
   * 그 패시브의 훅은 아무도 부르지 않는 코드다(N-06의 사문 셋과 같은 부채)
   */
  const covered = new Set(accepted.filter((item) => kindOf(item) === "enemy").flatMap((item) => Object.keys((item as Enemy).passives ?? {})));
  const passive_coverage = items.some((item) => kindOf(item) === "enemy") ? passiveNames.filter((name) => !covered.has(name)) : [];
  /**
   * 어느 층에도 놓이지 않은 편성. `encounter()`가 `data/map.json`을 통해서만 편성을 고르므로
   * 여기 남는 것은 아무도 부르지 않는 데이터다 — `passive_coverage`와 같은 자리라 반려가 아니라 목록이다.
   * 반려된 층은 놓은 것이 아니다: 세면 배포되지 않을 자리가 커버리지 구멍을 가린다
   */
  const placed = new Set(mergeById(shippedSlots, accepted.filter((item) => kindOf(item) === "map") as MapSlot[])
    .flatMap(({ groups }) => Object.values(groups ?? {}).flat()));
  const unplaced_groups = enemies.flatMap(({ groups }) => (groups ?? []).map(({ id }) => id)).filter((id) => !placed.has(id));
  /**
   * 3택1이 서지 않는 `신:tier`. 후보가 셋보다 적으면 화면이 두 칸짜리 「선택」을 띄운다 —
   * `passive_coverage`와 같은 자리라 반려가 아니라 목록이다(탓할 항목이 없다). 슬롯 넷이 매 tier마다
   * 다 찰 필요는 없다: 신당 슬롯 셋이면 그것으로 3택1이 선다
   */
  const grace_coverage = items.some((item) => kindOf(item) === "grace")
    ? Object.keys(gods).flatMap((god) => graceMilestones.flatMap((tier) =>
      graces.filter((grace) => grace.patron === god && grace.tier === tier).length < 3 ? [`${god}:${tier}`] : []))
    : [];
  return { accepted, rejected, pass_rate: items.length ? accepted.length / items.length : 0, by_pairing, failure_breakdown, pools, passive_coverage, unplaced_groups, grace_coverage };
}

function runCli(args: string[]): void {
  const inputs = args.filter((argument) => !argument.startsWith("--"));
  if (inputs.length === 0) throw new Error("Usage: npm run validate -- <path...> [--apply]");
  const items = inputs.flatMap((input) => statSync(input).isDirectory()
    ? readdirSync(input).filter((file) => file.endsWith(".json")).sort().map((file) => JSON.parse(readFileSync(join(input, file), "utf8")) as Item)
    : [JSON.parse(readFileSync(input, "utf8")) as Item | Item[]].flat());
  // 후보는 지금 배포된 풀 위에 얹어서 잰다 — staging 4장만 놓고 신의 완화 비율을 잴 수는 없다
  const shipped = (() => {
    try { return JSON.parse(readFileSync("data/cards.json", "utf8")) as Card[]; }
    catch { return []; }
  })().filter((card) => !items.some((item) => item.id === card.id));
  const report = validateItems(items, shipped);
  if (args.includes("--apply")) {
    mkdirSync("data", { recursive: true });
    for (const kind of ["card", "enemy", "demand", "god", "map", "grace"]) {
      const accepted = report.accepted.filter((item) => kindOf(item) === kind);
      if (accepted.length === 0) continue;
      const output = `data/${kind === "demand" ? "demands" : kind === "enemy" ? "enemies" : kind === "map" ? "map" : `${kind}s`}.json`;
      const existing = (() => {
        try { return JSON.parse(readFileSync(output, "utf8")) as Item[]; }
        catch { return []; }
      })();
      const merged = new Map([...existing, ...accepted].map((item) => [itemKey(item), item]));
      writeFileSync(output, `${JSON.stringify([...merged.values()], null, 2)}\n`);
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("validate.ts")) runCli(process.argv.slice(2));

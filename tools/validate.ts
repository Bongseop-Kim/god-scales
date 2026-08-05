import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { selfTokens } from "../core/rules.ts";
import { expectedValue, isValueAllowed, mitigationValue } from "./value.ts";

export type FailureKey = "schema" | "dsl_parse" | "token_scope" | "fusion_scope" | "demand_axis" | "duplicate" | "value_outlier" | "pool_ratio";
type Item = Record<string, unknown>;
type Card = Item & { id: string; name: string; patron?: string; patron_pair?: string[]; cost: number; target: string; effects: Effect[]; tags: string[] };
type Effect = { op: string; value?: number; token?: string; stacks?: number; when?: string };
type Demand = Item & { id: string; patron: string; condition: string; axis: string; polarity: string; min_enemies: number };
type Enemy = Item & {
  id: string;
  region: "underworld" | "surface";
  tier: "normal" | "boss";
  hp: number;
  pattern: (Effect & { repeat?: number })[];
  groups?: { id: string; with: string[] }[];
};

const required: Record<string, string[]> = {
  card: ["id", "name", "cost", "target", "effects", "tags"],
  enemy: ["id", "name", "region", "tier", "role", "hp", "intent_visible", "pattern", "pattern_mode"],
  demand: ["id", "patron", "condition", "text", "axis", "polarity", "min_enemies"],
  god: ["id", "name", "tokens", "ops", "rivals", "demands"],
};

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
const baselineDemands: Demand[] = [
  { id: "demand_zeus_solo", patron: "zeus", condition: "hit_targets_in_turn >= 1", axis: "target_spread", polarity: "+", min_enemies: 1 },
  { id: "demand_poseidon_solo", patron: "poseidon", condition: "hit_targets_in_turn <= 1", axis: "target_spread", polarity: "-", min_enemies: 1 },
  { id: "demand_athena_safe", patron: "athena", condition: "damage_taken == 0", axis: "damage_taken", polarity: "-", min_enemies: 1 },
  { id: "demand_ares_hurt", patron: "ares", condition: "damage_taken > 0", axis: "damage_taken", polarity: "+", min_enemies: 1 },
  { id: "demand_artemis_mark", patron: "artemis", condition: "tokens >= 1", axis: "token_load", polarity: "+", min_enemies: 1 },
];

function kindOf(item: Item): string {
  const id = String(item.id ?? "");
  if (id.startsWith("card_")) return "card";
  if (id.startsWith("enemy_")) return "enemy";
  if (id.startsWith("demand_")) return "demand";
  if (gods[id]) return "god";
  return "unknown";
}

// ponytail: required keys plus the one cross-field rule the schema was buying us (patron XOR patron_pair).
function schemaFailure(item: Item, kind: string): boolean {
  if (!required[kind] || required[kind].some((key) => item[key] === undefined)) return true;
  if (kind !== "card") return false;
  const card = item as Card;
  return Boolean(card.patron) === Boolean(card.patron_pair)
    || (card.patron_pair !== undefined && card.patron_pair.length !== 2)
    || ![0, 1, 2, 3].includes(card.cost)
    || !["self", "enemy", "all_enemies"].includes(card.target)
    || card.effects.length === 0
    || card.effects.some(({ op }) => typeof op !== "string");
}

function dslFailure(card: Card): boolean {
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

function fusionFailure(card: Card): boolean {
  if (!card.patron_pair) return false;
  const sorted = [...card.patron_pair].sort();
  return sorted.some((god, index) => god !== card.patron_pair![index])
    || card.tags.includes("exhaust")
    || card.patron_pair.some((god) => !vocabularyUsed(card, god));
}

function demandFailure(demand: Demand, demands: Demand[]): boolean {
  if (!axes.includes(demand.axis)) return true;
  const requiredEnemies = Number(demand.condition.match(/hit_targets_in_turn >= (\d+)/)?.[1] ?? demand.min_enemies);
  if (requiredEnemies !== demand.min_enemies) return true;
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

function stageEffectScopeFailure(god: Item): boolean {
  const definition = gods[String(god.id)];
  const effects = Object.values((god.stage_effects ?? {}) as Record<string, { on_encounter_start?: Effect }>).flatMap((stage) => stage.on_encounter_start ?? []);
  return effects.some(({ op, token }) =>
    (!commonOps.includes(op) && !definition.ops.includes(op))
    || (token !== undefined && !definition.tokens.includes(token)),
  );
}

function encounterThresholdFailure(enemy: Enemy, enemies: Enemy[]): boolean {
  if (enemy.tier === "boss") return enemy.hp !== (enemy.region === "underworld" ? 130 : 190) || enemy.groups !== undefined;
  if (!enemy.groups?.length) return true;
  const limits = enemy.region === "underworld"
    ? { hp: [40, 90], damage: [8, 14], count: [1, 2] }
    : { hp: [90, 170], damage: [14, 22], count: [2, 3] };
  const effectiveHp = (member: Enemy) => member.hp + member.pattern.reduce((total, effect) => total + (effect.op === "apply_token" && effect.token === "bulwark" ? effect.stacks ?? 1 : 0), 0);
  const intent = (member: Enemy) => member.pattern.reduce((total, effect) => total + (effect.op === "damage" ? (effect.value ?? 0) * (effect.repeat ?? 1) : 0), 0) / member.pattern.length;
  return enemy.groups.some((group) => {
    const members = [enemy, ...group.with.map((id) => enemies.find((candidate) => candidate.id === id))];
    if (members.some((member) => !member)) return true;
    const complete = members as Enemy[];
    const hp = complete.reduce((total, member) => total + effectiveHp(member), 0);
    const damage = complete.reduce((total, member) => total + intent(member), 0);
    return complete.length < limits.count[0] || complete.length > limits.count[1]
      || hp < limits.hp[0] || hp > limits.hp[1]
      || damage < limits.damage[0] || damage > limits.damage[1];
  });
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
 * 장당 기대값은 세기를 예측하지 못한다. 5.5는 아테나를 뺀 최고값(아르테미스 5.35) 바로 위다
 */
export const poolValueMax = 5.5;
export type PoolStat = { cards: number; value: number; mitigation: number; ratio: number; average: number };

export function poolStat(pool: Card[]): PoolStat {
  const value = pool.reduce((sum, card) => sum + expectedValue(card), 0);
  const mitigation = pool.reduce((sum, card) => sum + mitigationValue(card), 0);
  return { cards: pool.length, value, mitigation, ratio: mitigation / value, average: value / pool.length };
}

const worstBy = (pool: Card[], score: (card: Card) => number) => pool.reduce((left, right) => (score(left) >= score(right) ? left : right));

function poolRejects(cards: Card[]): Set<string> {
  const rejects = new Set<string>();
  for (const god of Object.keys(gods)) {
    // 합성 카드는 밴드가 6~10이고 신이 아니라 조합에 속한다 — 신의 풀에서 뺀다
    let pool = cards.filter((card) => card.patron === god);
    // 신당 24~33장이다. 10장 미만은 풀이 아니라 후보 묶음이므로 재지 않는다
    if (pool.length < 10) continue;
    // ponytail: 위반을 만든 카드를 하나씩 걷어낸다. O(n²)지만 신당 30장이다
    while (pool.length > 1) {
      const { ratio, average } = poolStat(pool);
      const worst = ratio > poolRatioMax ? worstBy(pool, mitigationValue)
        : average > poolValueMax ? worstBy(pool, expectedValue)
        : undefined;
      if (!worst) break;
      rejects.add(worst.id);
      pool = pool.filter(({ id }) => id !== worst.id);
    }
  }
  return rejects;
}

function failureFor(item: Item, cards: Card[], demands: Demand[], enemies: Enemy[]): FailureKey | undefined {
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
  if (kind === "enemy" && encounterThresholdFailure(item as Enemy, enemies)) return "value_outlier";
  return undefined;
}

export function validateItems(items: Item[], basePool: Card[] = []): { accepted: Item[]; rejected: { id: string; failure: FailureKey }[]; pass_rate: number; by_pairing: Record<string, number>; failure_breakdown: Partial<Record<FailureKey, number>>; pools: Record<string, PoolStat> } {
  const accepted: Item[] = [];
  const rejected: { id: string; failure: FailureKey }[] = [];
  const failure_breakdown: Partial<Record<FailureKey, number>> = {};
  const cards = [...baselineCards];
  const demands = [...baselineDemands, ...items.filter((item) => kindOf(item) === "demand") as Demand[]];
  const enemies = items.filter((item) => kindOf(item) === "enemy") as Enemy[];

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
  const overflow = poolRejects([...basePool, ...accepted.filter((item) => kindOf(item) === "card") as Card[]]);
  for (const item of [...accepted]) {
    if (!overflow.has(String(item.id))) continue;
    accepted.splice(accepted.indexOf(item), 1);
    rejected.push({ id: String(item.id), failure: "pool_ratio" });
    failure_breakdown.pool_ratio = (failure_breakdown.pool_ratio ?? 0) + 1;
  }
  const survivors = [...basePool, ...accepted.filter((item) => kindOf(item) === "card") as Card[]];
  const pools = Object.fromEntries(Object.keys(gods)
    .map((god) => [god, survivors.filter((card) => card.patron === god)] as const)
    .filter(([, pool]) => pool.length > 0)
    .map(([god, pool]) => [god, poolStat(pool)]));

  const fusionItems = items.filter((item) => Array.isArray(item.patron_pair));
  const by_pairing = Object.fromEntries([...new Set(fusionItems.map((item) => (item.patron_pair as string[]).join("+")))].map((pairing) => {
    const total = fusionItems.filter((item) => (item.patron_pair as string[]).join("+") === pairing).length;
    const passed = accepted.filter((item) => Array.isArray(item.patron_pair) && (item.patron_pair as string[]).join("+") === pairing).length;
    return [pairing, passed / total];
  }));
  return { accepted, rejected, pass_rate: items.length ? accepted.length / items.length : 0, by_pairing, failure_breakdown, pools };
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
    for (const kind of ["card", "enemy", "demand", "god"]) {
      const accepted = report.accepted.filter((item) => kindOf(item) === kind);
      if (accepted.length === 0) continue;
      const output = `data/${kind === "demand" ? "demands" : kind === "enemy" ? "enemies" : `${kind}s`}.json`;
      const existing = (() => {
        try { return JSON.parse(readFileSync(output, "utf8")) as Item[]; }
        catch { return []; }
      })();
      const merged = new Map([...existing, ...accepted].map((item) => [String(item.id), item]));
      writeFileSync(output, `${JSON.stringify([...merged.values()], null, 2)}\n`);
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("validate.ts")) runCli(process.argv.slice(2));

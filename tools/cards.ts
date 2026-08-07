import { writeFileSync } from "node:fs";
import cardData from "../data/cards.json" with { type: "json" };
import { godDecks } from "../sim/engine.ts";
import { cardTier, expectedValue } from "./value.ts";

/**
 * `CARDS.md`를 데이터에서 다시 만든다. 손으로 쓴 표는 `data/cards.json`이 바뀌는 순간 썩는데
 * 카드는 회차마다 는다 — 129장이 두 회차 만에 179장이 됐다.
 *
 * 뜻은 안 적는다. 토큰이 무슨 일을 하는지는 README, 왜 그 값인지는 reviews가 든다 —
 * 여기가 그걸 또 적으면 세 곳이 어긋난다. 이 문서가 드는 것은 **지금 배포된 149장이 무엇인가** 하나다
 */

type Effect = { op: string; value?: number; token?: string; stacks?: number; when?: string; god?: string };
type Card = { id: string; name: string; patron?: string; patron_pair?: string[]; cost: number; target: string; effects: Effect[]; tags: string[]; trigger?: string; reach?: string; tier?: number; upgrade?: unknown };

const cards = cardData as Card[];
const godNames: Record<string, string> = { zeus: "제우스", poseidon: "포세이돈", athena: "아테나", ares: "아레스", artemis: "아르테미스" };
const tokenNames: Record<string, string> = { shock: "감전", displace: "밀려남", soaked: "침수", bulwark: "보루", deflect: "반사", bleed: "출혈", frenzy: "광란", mark: "표식", crit: "치명", thorns: "가시", might: "위력" };
const fusedCount = cards.filter((card) => card.patron_pair).length;
const tagNames: Record<string, string> = { attack: "공", defend: "방", utility: "유", token: "토", multi: "광", power: "파", fused: "융", favor: "호", exhaust: "소" };
const targetNames: Record<string, string> = { self: "자신", enemy: "적1", all_enemies: "전체" };

function describe(effect: Effect): string {
  const { op, value = 0, token, stacks = 1 } = effect;
  const text = op === "apply_token" ? `${tokenNames[token!] ?? token} ${stacks}`
    : op === "damage" ? `피해 ${value}`
    : op === "chain" ? `연쇄 ${value}`
    : op === "block" ? `방어 ${value}`
    : op === "draw" ? `뽑기 ${value}`
    : op === "energy" ? `에너지 +${value}`
    : op === "heal" ? `회복 ${value}`
    : op === "self_damage" ? `자해 ${value}`
    : op === "favor_shift" ? `호의 ${value > 0 ? "+" : ""}${value}`
    : `${op} ${value}`;
  return effect.when ? `${text} 〈${effect.when}〉` : text;
}

/** 시작 덱 표시는 `sim/engine.ts`의 `godDecks`를 읽는다 — 태그 선발 규칙을 여기서 다시 쓰면 두 번째 진실이다 */
const starters = new Set(Object.values(godDecks).flat());

const line = (card: Card): string => [
  starters.has(card.id) ? `${card.name} ★` : card.name,
  card.cost,
  cardTier(card),
  targetNames[card.target],
  card.reach ?? "0123",
  card.effects.map(describe).join(" · ") + (card.trigger ? ` @${card.trigger}` : ""),
  card.tags.map((tag) => tagNames[tag] ?? tag).join(""),
  expectedValue(card).toFixed(2),
].join(" | ");

const header = "| 이름 | 코 | T | 대상 | 사거리 | 효과 | 태그 | EV |\n|---|--:|--:|---|---|---|---|--:|";
const out: string[] = [
  `# 카드 ${cards.length}장`,
  "",
  "`npm run cards`가 `data/cards.json`에서 다시 만든다 — 손으로 고치지 않는다.",
  "",
  "표기: `코` 코스트 · `T` 티어 · 사거리 `0`앞 → `3`뒤 · `★` 시작 덱 · `@` 파워 훅 · `〈 〉` 조건 · `EV` 게이트 기대값(`tools/value.ts`)",
  "태그: 공격 · 방어 · 유틸 · 토큰 · 광역 · 파워 · 융합 · 호의 · 소진",
  "",
  "토큰이 무슨 일을 하는지는 [README](README.md#토큰), 왜 그 값인지는 [reviews/](reviews/)가 든다.",
  "",
  "## 티어",
  "",
  "값의 계단 셋. 반개구간이라 안 겹친다 (`tools/value.ts`의 `valueBands`).",
  "",
  "| 티어 | 값 밴드 | 장수 | 어디서 나오는가 |",
  "|---|---|--:|---|",
  "| 1 | `[4, 8)` | " + cards.filter((card) => cardTier(card) === 1).length + " | 모든 전투 보상 3택1. 시작 덱 3장도 여기서 뽑는다 |",
  "| 2 | `[8, 10)` | " + cards.filter((card) => cardTier(card) === 2).length + " | **정예·보스 보상에서만** — 그때는 세 자리가 전부 tier2다 (`sim/engine.ts`의 `tier2Slots`) |",
  "| 3 | `[10, 13]` | " + cards.filter((card) => cardTier(card) === 3).length + " | 융합 전용. 두 신의 은혜를 각각 하나씩 받으면 열린다 |",
  "",
  "tier2는 **신당 여섯 장**이다. 정예·보스가 세 자리를 전부 tier2로 채우므로 셋보다 적으면 `rewardOffer`가 던진다.",
  "한 런의 tier2 보상은 2~3회뿐이라 조합의 열두 장 중 절반쯤을 본다 (P-44 §4).",
  "자유 덱 편집기에는 tier1만 뜬다.",
  "",
  "## 업그레이드",
  "",
  "덱의 **그 한 장**이 커진다. `+1`·`+2`는 카드 목록이 아니라 id 접미사가 든다(`card_zeus_12+1`).",
  "",
  "| | |",
  "|---|---|",
  "| 규칙 | `damage`·`block`·`heal`·`chain`을 ×1.4 올림. `draw`·`energy`·스택·`self_damage`는 그대로 |",
  "| 예외 | " + cards.filter((card) => card.upgrade).length + "장이 `upgrade` 필드를 갖는다 — 퍼센트로 못 올리는 카드다. 비용 델타도 받고, 비용은 0에서 멈춘다 |",
  "| 상한 | `+2`. 융합 " + fusedCount + "장은 대상 밖이다 |",
  "| 얻는 곳 | 휴식처 3택 (회복 · 제거 · **강화**) |",
];

for (const [god, name] of Object.entries(godNames)) {
  const own = cards.filter((card) => card.patron === god);
  const byTier = (tier: number) => own.filter((card) => cardTier(card) === tier);
  out.push("", `## ${name} (${own.length}장 — tier1 ${byTier(1).length} · tier2 ${byTier(2).length})`, "", header);
  for (const card of [...byTier(1), ...byTier(2)]) out.push(`| ${line(card)} |`);
}

const fused = cards.filter((card) => card.patron_pair);
out.push("", `## 융합 (${fused.length}장 — 전부 tier3)`, "", "| 이름 | 신쌍 | 코 | 사거리 | 효과 | 태그 | EV |", "|---|---|--:|---|---|---|--:|");
for (const card of fused) {
  out.push(`| ${card.name} | ${card.patron_pair!.map((god) => godNames[god]).join("+")} | ${card.cost} | ${card.reach ?? "0123"} | ${card.effects.map(describe).join(" · ")} | ${card.tags.map((tag) => tagNames[tag] ?? tag).join("")} | ${expectedValue(card).toFixed(2)} |`);
}

const path = new URL("../CARDS.md", import.meta.url);
writeFileSync(path, out.join("\n") + "\n");
console.log(`CARDS.md · ${cards.length}장`);

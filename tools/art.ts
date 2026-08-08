/**
 * 에셋 게이트 — **데이터 id ↔ 파일명을 여섯 종류로 대조한다.**
 *
 * 파일명이 이미 데이터 id와 1:1이라(`enemy_under_pressure` ↔ `art/sprites/enemy_under_pressure.webp`)
 * 어긋남은 눈이 아니라 문자열 비교가 잡는다. R-32의 「게이트가 두 번 새어 나갔다 — 목록을 눈으로
 * 훑었기 때문이다」가 근거다. 이름 짓는 규칙은 화면과 공유한다(`ui/art-keys.ts`) — 규칙이 두 벌이면
 * 「게이트는 통과했는데 화면은 빈다」가 생긴다
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { regions } from "../core/map.ts";
import { tokenNames } from "../core/state.ts";
import { godDecks } from "../sim/engine.ts";
import { artRegion, backdropName, tagParticle, type CardArtSource } from "../ui/shared/art-keys.ts";
import { iconIds } from "./icons.ts";

type CardData = CardArtSource & { name: string; effects: { op: string; value?: number; token?: string; stacks?: number }[] };
const readData = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8")) as T;
const cards = readData<CardData[]>("cards");
const enemies = readData<{ id: string }[]>("enemies");
const gods = readData<{ id: string }[]>("gods");

const names = (directory: string, extension = ".webp"): Set<string> =>
  new Set(existsSync(`art/${directory}`) ? readdirSync(`art/${directory}`).filter((name) => name.endsWith(extension)).map((name) => name.slice(0, -extension.length)) : []);
const [sprites, cardArt, godArt, bg, props, fx, hero, frame, marker, particle, cursor, tokenArt] =
  [["sprites"], ["cards"], ["gods"], ["bg"], ["props"], ["fx"], ["hero"], ["ui"], ["ui", ".png"], ["particle"], ["cursor-pixel", ".png"], ["tokens"]]
    .map(([directory, extension]) => names(directory, extension));
const missingFrom = (have: Set<string>, need: string[]) => need.filter((name) => !have.has(name));
/**
 * 아이콘은 파일 28개가 아니라 **symbol 28개가 든 파일 하나**다. 그래서 대조도 파일명이 아니라 시트
 * 안의 id로 한다 — `<use href="#icon-shock">`가 없는 id를 가리키면 배지가 조용히 빈 원이 된다
 */
const symbols = new Set([...readFileSync("art/icons.svg", "utf8").matchAll(/id="icon-([\w-]+)"/g)].map(([, id]) => id));
/** P-51부터 카드 아트는 데이터 id와 1:1이다 — 폴백(`cardArtCandidates`)은 화면 몫이고 게이트는 id만 본다. */
const unresolved = cards.filter((card) => !cardArt.has(card.id));

const checks = [
  { kind: "sprites", made: 20, found: sprites.size, missing: missingFrom(sprites, [...enemies.map(({ id }) => id), "player"]) },
  { kind: "cards", made: 179, found: cardArt.size, missing: unresolved.map(({ id }) => id) },
  { kind: "gods", made: 5, found: godArt.size, missing: missingFrom(godArt, gods.map(({ id }) => id)) },
  { kind: "bg", made: 6, found: bg.size, missing: missingFrom(bg, regions.flatMap((region) => (["map", "combat", "boss"] as const).map((spot) => backdropName(region, spot)))) },
  // 프롭은 이름을 데이터가 안 부른다 — 배경 위에 지역별로 **둘**을 얹으므로 그 하한이 곧 대조다
  { kind: "props", made: 14, found: props.size, missing: regions.filter((region) => [...props].filter((name) => name.startsWith(`${artRegion(region)}_`)).length < 2) },
  // 토큰 아이콘은 `tokenNames`가 목록이다(P-57) — 토큰을 새로 만들면 아이콘이 없다고 여기서 막힌다
  { kind: "tokens", made: 13, found: tokenArt.size, missing: missingFrom(tokenArt, [...tokenNames]) },
  {
    kind: "fixed",
    made: 12,
    found: 12,
    missing: [
      ...missingFrom(fx, ["devotion", "calm", "anger", "wrath", "burst", "strike"]),
      ...missingFrom(hero, ["hero-title", "hero-win", "hero-loss"]),
      ...missingFrom(frame, ["card-frame", "dialogue"]),
      ...missingFrom(marker, ["marker"]),
      // 커서·파티클·아이콘은 제작 83개가 아니다(Kenney CC0 · game-icons.net CC BY). 쓰는 것만 이름을 잠근다
      ...missingFrom(particle, Object.values(tagParticle)),
      ...missingFrom(cursor, ["tile_0026", "tile_0134", "tile_0015"]),
      ...missingFrom(symbols, iconIds),
    ],
  },
];

if (process.argv.includes("--list")) {
  console.log("id,name,patron,effects");
  for (const card of cards) {
    const patron = card.patron ?? card.patron_pair?.join("+") ?? "neutral";
    const effects = card.effects.map(({ op, value, token, stacks }) => `${op}:${value ?? token ?? stacks ?? ""}`).join(";");
    console.log([card.id, card.name, patron, effects].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  }
} else if (process.argv.includes("--check")) {
  // 시작 덱 15장은 모든 런의 첫 손패에 뜬다 — 나머지는 보상으로 뽑혀야 화면에 나온다
  const starters = new Set(Object.values(godDecks).flat());
  const requiredMissing = unresolved.filter(({ id }) => starters.has(id));
  console.log(`cards=${cards.length} present=${cards.length - unresolved.length} required_missing=${requiredMissing.length} deferred_missing=${unresolved.length - requiredMissing.length}`);
  const made = checks.reduce((sum, { made: count }) => sum + count, 0);
  const built = checks.reduce((sum, { found }) => sum + found, 0);
  console.log(`made=${built}/${made} ${checks.map(({ kind, found, made: count }) => `${kind} ${found}/${count}`).join(" · ")}`);
  for (const { kind, missing } of checks) for (const name of missing) console.log(`[${kind}] ${name} — 데이터에 있는데 파일이 없다`);
  const violations = checks.filter(({ missing }) => missing.length).length + (built === made ? 0 : 1);
  console.log(`대조 위반 ${violations}`);
  if (violations) process.exitCode = 1;
} else throw new Error("use --list or --check");

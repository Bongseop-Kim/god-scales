import { existsSync, readdirSync, readFileSync } from "node:fs";
import { godDecks } from "../sim/engine.ts";

type CardData = { id: string; name: string; patron?: string; patron_pair?: string[]; effects: { op: string; value?: number; token?: string; stacks?: number }[] };
const cards = JSON.parse(readFileSync(new URL("../data/cards.json", import.meta.url), "utf8")) as CardData[];
// 시작 덱 15장이 필수다 — 모든 런의 첫 손패에 뜬다. 나머지는 보상으로 뽑혀야 화면에 나온다
const starterIds = new Set(Object.values(godDecks).flat());
const starters = cards.filter(({ id }) => starterIds.has(id));
const generated = cards.filter(({ id }) => !starterIds.has(id));
const existing = new Set(existsSync("art/cards") ? readdirSync("art/cards").filter((name) => name.endsWith(".webp")).map((name) => name.replace(/\.webp$/, "")) : []);
const missing = cards.filter(({ id }) => !existing.has(id));

if (process.argv.includes("--list")) {
  console.log("id,name,patron,effects");
  for (const card of cards) {
    const patron = card.patron ?? card.patron_pair?.join("+") ?? "neutral";
    const effects = card.effects.map(({ op, value, token, stacks }) => `${op}:${value ?? token ?? stacks ?? ""}`).join(";");
    console.log([card.id, card.name, patron, effects].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  }
} else if (process.argv.includes("--check")) {
  const requiredMissing = starters.filter(({ id }) => !existing.has(id));
  const deferredMissing = generated.filter(({ id }) => !existing.has(id));
  console.log(`cards=${cards.length} present=${cards.length - missing.length} required_missing=${requiredMissing.length} deferred_missing=${deferredMissing.length}`);
  for (const card of requiredMissing) console.log(`[required] ${card.id}`);
  for (const card of deferredMissing) console.log(`[deferred:not-in-current-run] ${card.id}`);
  if (requiredMissing.length) process.exitCode = 1;
} else throw new Error("use --list or --check");

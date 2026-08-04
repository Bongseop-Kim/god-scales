import { existsSync, readdirSync, readFileSync } from "node:fs";

type CardData = { id: string; name: string; patron?: string; patron_pair?: string[]; effects: { op: string; value?: number; token?: string; stacks?: number }[] };
const starters: CardData[] = [
  { id: "strike", name: "타격", patron: "zeus", effects: [{ op: "damage", value: 7 }] },
  { id: "guard", name: "방어", patron: "athena", effects: [{ op: "block", value: 6 }] },
  { id: "spark", name: "불꽃", patron: "zeus", effects: [{ op: "damage", value: 4 }, { op: "apply_token", token: "shock", stacks: 1 }] },
];
const generated = JSON.parse(readFileSync(new URL("../data/cards.json", import.meta.url), "utf8")) as CardData[];
const cards = [...starters, ...generated];
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

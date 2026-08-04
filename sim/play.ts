import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { run } from "./engine.ts";
import type { ReplayAction, ReplayFile } from "./replay.ts";

const scripted = stdin.isTTY ? [] : readFileSync(0, "utf8").trim().split(/\s+/);
const terminal = stdin.isTTY ? createInterface({ input: stdin, output: stdout }) : undefined;
const answer = (prompt: string) => terminal ? terminal.question(prompt) : Promise.resolve(scripted.shift() ?? "");
const seed = Number(await answer("seed: "));
if (!Number.isInteger(seed)) throw new Error("seed must be an integer");
const actions: ReplayAction[] = [];
for (const label of ["지하 3층", "지하 5층", "지상 3층", "지상 5층"]) {
  const choice = (await answer(`${label} [c]ombat/[r]est: `)).trim().toLowerCase();
  if (choice !== "c" && choice !== "r") throw new Error("enter c or r");
  actions.push({ type: "path", choice: choice === "c" ? "combat" : "rest" });
}
terminal?.close();

const result = run(seed, undefined, actions);
console.log(result.log.join("\n"));
const replay: ReplayFile = { seed, actions, replay_mode: "action_log" };
mkdirSync("logs/human", { recursive: true });
const path = `logs/human/run-${seed}.json`;
writeFileSync(path, `${JSON.stringify(replay, null, 2)}\n`);
console.log(`export=${path} outcome=${result.won ? "victory" : "defeat"} encounters=${result.encounters} hp=${result.hpCurve.at(-1)}`);

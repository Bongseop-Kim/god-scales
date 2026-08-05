import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { run, runSteps } from "./engine.ts";
import type { ReplayAction, ReplayFile } from "./replay.ts";

const scripted = stdin.isTTY ? [] : readFileSync(0, "utf8").trim().split(/\s+/);
const terminal = stdin.isTTY ? createInterface({ input: stdin, output: stdout }) : undefined;
const answer = (prompt: string) => terminal ? terminal.question(prompt) : Promise.resolve(scripted.shift() ?? "");
const seed = Number(await answer("seed: "));
if (!Number.isInteger(seed)) throw new Error("seed must be an integer");

/**
 * 갈래는 이제 격자가 정하므로 물음을 미리 적어 둘 수 없다 — 제너레이터를 돌리며 `path`에서만 묻고
 * 나머지는 봇 답을 쓴다. 입력은 갈래 번호이고 화면에 그 층의 종류가 같이 뜬다
 */
const actions: ReplayAction[] = [];
const steps = runSteps(seed);
let step = steps.next();
while (!step.done) {
  if (step.value.phase !== "path") {
    step = steps.next(step.value.bot);
    continue;
  }
  const { options, observation } = step.value;
  const choice = (await answer(`${observation.region} ${observation.floor}층 [${options.join(" / ")}]: `)).trim();
  const picked = options.includes(choice) ? choice : options.find((option) => option.startsWith(`${choice}:`));
  if (!picked) throw new Error(`enter one of ${options.join(", ")}`);
  actions.push({ type: "path", choice: picked });
  step = steps.next(picked);
}
terminal?.close();

const result = run(seed, undefined, actions);
console.log(result.log.join("\n"));
const replay: ReplayFile = { seed, actions, replay_mode: "action_log" };
mkdirSync("logs/human", { recursive: true });
const path = `logs/human/run-${seed}.json`;
writeFileSync(path, `${JSON.stringify(replay, null, 2)}\n`);
console.log(`export=${path} outcome=${result.won ? "victory" : "defeat"} encounters=${result.encounters} hp=${result.hpCurve.at(-1)}`);

/**
 * 브라우저 E2E — 진짜 클릭으로 런을 끝까지 몰고, 반출한 JSON을 CLI가 그대로 재생하는지 본다.
 *
 * `test/ui.test.ts`는 화면을 관측값만으로 그리는지까지만 본다. 여기서 보는 것은 그 위의 층이다:
 * App의 이벤트 배선(`answer`)·화면 전환·반출 버튼이 실제로 엔진을 움직이는가. vitest에 넣지 않는 이유는
 * dev 서버와 Aside 브라우저가 필요해서다 — `npm run e2e`로 따로 돈다.
 *
 * 규칙(CLAUDE.md): 브라우저는 `aside` CLI로만 만진다. `aside repl`은 모델을 쓰지 않아 크레딧과 무관하다.
 */
import { spawn, spawnSync } from "node:child_process";
import { run } from "../sim/engine.ts";
import type { ReplayFile } from "../sim/replay.ts";

const port = 5199;
/** 아래 클릭 정책으로 여덟 결정 phase를 전부 지나는 가장 짧은 시드다(215 결정). 바꾸면 다시 찾아야 한다 */
const seed = 56;
const phases = ["path", "card", "target", "rest", "rest_card", "reward", "grace", "demand"];

/**
 * 정책은 화면에 있는 버튼의 위치만 쓴다 — 봇 추천은 DOM에 없고, 있어서도 안 된다.
 * 첫 갈림길만 휴식으로 가서 쉼터·카드 제거를 지나고, 전투에서는 낼 수 있는 마지막 카드를 누른다.
 */
const browserScript = `
const tab = await openTab("http://localhost:${port}/");
await tab.bringToFront();
await tab.waitForSelector("[data-phase='setup']");
await tab.fill("input[type=number]", "${seed}");
await tab.click("form.setup button.primary");
await tab.waitForSelector("[data-phase]:not([data-phase='setup'])");

// 한 evaluate에 런 전체를 넣으면 CDP가 30초에 끊는다 — 드라이버를 페이지에 심고 조금씩 돌린다
await tab.evaluate(() => {
  const section = () => [...document.querySelectorAll("[data-phase]")].at(-1);
  const state = () => { const el = section(); return { phase: el.dataset.phase, step: Number(el.dataset.step) }; };
  const enabled = (selector) => [...document.querySelectorAll(selector)].filter((el) => !el.disabled && el.isConnected);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  /** 퇴장 중인 옛 화면·옛 손패도 DOM에 남아 클릭될 수 있다 — 눌러보고 안 움직이면 다음 후보로 넘어간다 */
  const advance = async (from, candidates) => {
    if (!candidates.length) throw new Error("no clickable option");
    for (const element of candidates) {
      element.click();
      for (let tick = 0; tick < 40; tick += 1) {
        await wait(25);
        if (state().step > from) return;
      }
    }
    throw new Error("click did not advance the engine");
  };

  const driver = { order: [], paths: 0 };
  driver.slice = async (count) => {
    for (let done = 0; done < count; done += 1) {
      const { phase, step } = state();
      if (phase === "result") return { done: true, decisions: driver.order.length };
      driver.order.push(phase);
      const choices = phase === "path"
        ? [driver.paths++ === 0 ? document.querySelector("button.choice.rest") : document.querySelector("button.choice.combat")]
        : phase === "rest"
        ? [enabled("button.choice")[1]]
        : phase === "demand"
        ? [enabled("button.choice")[0]]
        : phase === "target"
        ? enabled("button.enemy")
        : phase === "card"
        ? [...enabled(".hand button.game-card")].reverse().concat(enabled(".decision-panel button.primary"))
        : enabled(".hand button.game-card");
      await advance(step, choices.filter(Boolean));
    }
    return { done: state().phase === "result", decisions: driver.order.length };
  };
  window.__e2e = driver;
});

for (let batch = 0; ; batch += 1) {
  if (batch > 200) throw new Error("run never reached the result screen");
  const progress = await tab.evaluate(() => window.__e2e.slice(15));
  if (progress.done) break;
}

const captured = await tab.evaluate(async () => {
  // 반출은 Blob을 만들고 즉시 revoke한다 — Blob 자체를 잡아야 내용을 읽을 수 있다.
  // 앵커 클릭은 삼킨다: 파일을 사용자 다운로드 폴더에 떨어뜨리지 않고도 반출물은 그대로 검사된다
  const blobs = [];
  const createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => { blobs.push(blob); return createObjectURL(blob); };
  const anchorClick = HTMLAnchorElement.prototype.click;
  let filename;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download) return anchorClick.call(this);
    filename = this.download;
  };
  document.querySelector(".result-layout .actions button.primary").click();
  URL.createObjectURL = createObjectURL;
  HTMLAnchorElement.prototype.click = anchorClick;
  if (!blobs.length) throw new Error("export produced no blob");

  const summary = {};
  for (const article of document.querySelectorAll(".summary-grid article")) {
    summary[article.querySelector("small").textContent] = Number(article.querySelector("strong").textContent);
  }
  return {
    order: window.__e2e.order,
    filename,
    replay: JSON.parse(await blobs[0].text()),
    won: document.querySelector(".result-layout h1").textContent === "승리",
    floors: Number(document.querySelector(".result-layout .eyebrow").textContent.match(/· (\\d+)\\/12층/)[1]),
    summary,
  };
});
await closeTab(tab);
console.log("__E2E__" + JSON.stringify(captured));
`;

function browserRun(): {
  order: string[];
  filename: string;
  replay: ReplayFile;
  won: boolean;
  floors: number;
  summary: Record<string, number>;
} {
  // 브라우저가 멈춰도 CI가 영원히 기다리지 않게 한다 — 한 런은 보통 2~3분이다
  const { stdout, stderr, status, error } = spawnSync("aside", ["repl", browserScript], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000 });
  if (error || status !== 0) throw new Error(`aside repl failed (status ${status}): ${error?.message ?? ""}\n${stdout ?? ""}\n${stderr ?? ""}`);
  const line = stdout.split("\n").find((text) => text.startsWith("__E2E__"));
  if (!line) throw new Error(`aside repl printed no __E2E__ line:\n${stdout}\n${stderr}`);
  return JSON.parse(line.slice("__E2E__".length));
}

function check(label: string, actual: unknown, expected: unknown): void {
  const [left, right] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (left !== right) throw new Error(`${label}: ${left} !== ${right}`);
  console.log(`  ok  ${label} = ${left}`);
}

const server = spawn("npx", ["vite", "--port", String(port), "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
// 죽은 서버를 30초 동안 기다리다 fetch 오류로 끝나면 원인이 안 보인다 — 출력을 잡아 두고 즉시 던진다
let serverLog = "";
let serverDied: string | undefined;
server.stdout.on("data", (chunk) => { serverLog += chunk; });
server.stderr.on("data", (chunk) => { serverLog += chunk; });
server.on("error", (error) => { serverDied ??= `vite failed to spawn: ${error.message}`; });
server.on("exit", (code, signal) => { serverDied ??= `vite exited early (code ${code}, signal ${signal})`; });
try {
  for (let tries = 0; ; tries += 1) {
    if (serverDied) throw new Error(`${serverDied}\n${serverLog}`);
    try {
      await fetch(`http://localhost:${port}/`);
      break;
    } catch (error) {
      if (tries > 60) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const browser = browserRun();
  const cli = run(seed, undefined, browser.replay.actions);

  console.log(`clicked ${browser.order.length} decisions in the browser`);
  check("phases", [...new Set(browser.order)].sort(), [...phases].sort());
  // 종류 집합만 보면 순서가 뒤집히거나 라벨이 바뀌어도 통과한다 — 누른 순서 그대로 반출됐는지 본다.
  // 215개를 다 찍으면 로그를 못 읽으므로 어긋난 첫 자리만 남긴다
  const exported = browser.replay.actions.map(({ type }) => type);
  const diverged = browser.order.findIndex((phase, index) => exported[index] !== phase);
  check("반출 순서", { diverged, length: exported.length }, { diverged: -1, length: browser.order.length });
  check("filename", browser.filename, `god-scales-run-${seed}.json`);
  check("replay header", { seed: browser.replay.seed, mode: browser.replay.replay_mode }, { seed, mode: "action_log" });
  // 반출한 결정이 지금 규칙에서 전부 낼 수 있는 것이어야 한다 — 하나라도 아니면 봇이 대신 답한다
  check("substituted", cli.substituted, 0);
  check("outcome", { won: cli.won, floors: Math.min(12, cli.hpCurve.length - 1) }, { won: browser.won, floors: browser.floors });
  check("최종 체력", cli.hpCurve.at(-1), browser.summary["최종 체력"]);
  check("전투 횟수", cli.encounters, browser.summary["전투 횟수"]);
  // 신 이름은 화면이 한글로 붙인다 — 라벨을 흉내내지 않고 남은 칸의 값만 호의와 맞춘다
  const shown = Object.entries(browser.summary).filter(([label]) => label.endsWith("호의")).map(([, value]) => value);
  const favor = Object.values(cli.favorCurve.at(-1) ?? {});
  check("호의", shown.sort(), favor.sort());
  // 사람이 고른 것과 봇이 고른 것이 실제로 다르다 — 같으면 위 비교가 아무것도 증명하지 않는다
  check("봇 기본값과 다른 카드열", cli.cardsPlayed.join() !== run(seed).cardsPlayed.join(), true);
  console.log("e2e ok");
} finally {
  server.kill();
}

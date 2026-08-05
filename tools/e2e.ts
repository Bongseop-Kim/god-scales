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
/**
 * 아래 클릭 정책으로 **12층을 완주하면서** 여덟 결정 phase를 전부 지나는 가장 짧은 시드다(503 결정).
 * 400개를 훑어 다섯 개뿐이다(51·69·141·162·291) — 정책이나 콘텐츠가 바뀌면 다시 찾아야 한다.
 */
const seed = 141;
const phases = ["path", "card", "target", "rest", "rest_card", "reward", "grace", "demand"];

/**
 * 정책은 화면에 적힌 것만 쓴다 — 봇 추천은 DOM에 없고, 있어서도 안 된다. 룰 봇을 브라우저로 옮겨 심지도
 * 않는다(두 번째 진실이 생긴다). 대신 사람이 화면만 보고 낼 법한 최소한의 규칙을 쓴다:
 *
 * - 갈림길: 쉼터가 있으면 쉼터, 없으면 첫 칸
 * - 휴식: 첫 번째만 카드 제거(그래야 `rest_card`를 지난다), 이후는 회복
 * - 요구: 수락
 * - 표적: 체력이 가장 낮은 적 — 동점이면 화면 순서
 * - 카드·보상·은총·제거: 캡션에 적힌 비용이 가장 높은 것, 동점이면 표시된 피해, 그래도 같으면 카드 id
 *
 * "누를 수 있는 첫/마지막 카드"는 최악의 정책이라 400시드 중 완주가 하나도 없었다. 완주 없는 E2E는
 * 결과 화면과 반출을 지나지 못하므로 B-0 4번을 증명하지 못한다.
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

  /** 캡션은 "2 에너지 · 피해 9 · 방어 3" 꼴이다. 화면에 적힌 숫자만 읽는다 */
  const caption = (button) => button.querySelector("small")?.textContent ?? "";
  const cardCost = (button) => Number(caption(button).match(/^(\\d+) 에너지/)?.[1] ?? -1);
  const cardDamage = (button) => [...caption(button).matchAll(/(?:피해|연쇄) (\\d+)/g)].reduce((sum, [, value]) => sum + Number(value), 0);
  const enemyHp = (button) => Number(button.querySelector(".hp small")?.textContent.split("/")[0] ?? 0);
  /** 비용 → 피해 → id 순의 전순서. 화면 순서에 기대지 않아야 CLI 쪽 기대값과 어긋나지 않는다 */
  const bestCard = () => enabled(".hand button.game-card").sort((left, right) =>
    cardCost(right) - cardCost(left)
    || cardDamage(right) - cardDamage(left)
    || (left.dataset.card < right.dataset.card ? -1 : 1));

  /** 화면 기하는 여기서 한 번만 잰다 — 드라이버가 이미 여덟 화면을 다 지나므로 따로 훑을 이유가 없다 */
  const box = (node) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { left: Math.round(rect.left), width: Math.round(rect.width), gapRight: Math.round(window.innerWidth - rect.right) };
  };
  const measure = (root) => {
    const layout = root.querySelector(".run-layout") ?? root.querySelector(".shell") ?? root;
    return {
      vw: window.innerWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      twoColumn: layout.classList.contains("run-layout"),
      layout: box(layout),
      cols: [...layout.children].filter((child) => child.tagName !== "HEADER").map((child) => ({ cls: child.className, ...box(child) })),
    };
  };

  const driver = { order: [], rests: 0, layout: {} };
  driver.slice = async (count) => {
    for (let done = 0; done < count; done += 1) {
      const { phase, step } = state();
      if (phase === "result") return { done: true, decisions: driver.order.length };
      driver.order.push(phase);
      driver.layout[phase] ??= measure(section());
      const choices = phase === "path"
        ? [document.querySelector("button.choice.rest") ?? enabled("button.choice")[0]]
        : phase === "rest"
        ? [enabled("button.choice")[driver.rests++ === 0 ? 1 : 0]]
        : phase === "demand"
        ? [enabled("button.choice")[0]]
        : phase === "target"
        ? enabled("button.enemy").sort((left, right) => enemyHp(left) - enemyHp(right))
        : phase === "card"
        ? bestCard().concat(enabled(".decision-panel button.primary"))
        : bestCard();
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
    layout: window.__e2e.layout,
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

type ScreenBox = { left: number; width: number; gapRight: number } | null;
type ScreenLayout = { vw: number; overflowX: boolean; twoColumn: boolean; layout: ScreenBox; cols: { cls: string; left: number; width: number; gapRight: number }[] };

function browserRun(): {
  order: string[];
  layout: Record<string, ScreenLayout>;
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

/**
 * `--dist`는 dev 서버 대신 `npm run build` 산출물을 그대로 띄운다. B-0 4번은 "**배포본**으로 1런 완주"라
 * dev 번들로는 증명이 반쪽이다 — 공개 URL에 올라가는 것과 같은 파일을 눌러야 한다
 */
const useDist = process.argv.includes("--dist");
const server = spawn("npx", useDist ? ["vite", "preview", "--port", String(port), "--strictPort"] : ["vite", "--port", String(port), "--strictPort"], { stdio: ["ignore", "pipe", "pipe"] });
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
  // B-0 4번은 "배포본으로 1런 완주"다 — 도중에 죽으면 결과 화면과 반출을 지나도 완주를 증명하지 못한다
  check("완주", { won: browser.won, floors: browser.floors }, { won: true, floors: 12 });
  check("최종 체력", cli.hpCurve.at(-1), browser.summary["최종 체력"]);
  check("전투 횟수", cli.encounters, browser.summary["전투 횟수"]);
  // 신 이름은 화면이 한글로 붙인다 — 라벨을 흉내내지 않고 남은 칸의 값만 호의와 맞춘다
  const shown = Object.entries(browser.summary).filter(([label]) => label.endsWith("호의")).map(([, value]) => value);
  const favor = Object.values(cli.favorCurve.at(-1) ?? {});
  check("호의", shown.sort(), favor.sort());
  // 사람이 고른 것과 봇이 고른 것이 실제로 다르다 — 같으면 위 비교가 아무것도 증명하지 않는다
  check("봇 기본값과 다른 카드열", cli.cardsPlayed.join() !== run(seed).cardsPlayed.join(), true);

  // P-19에서 "본문이 좌측 컬럼에 몰리고 우측이 빈다"고 적힌 자리다. 여덟 화면 전부를 여기서 잠근다 —
  // `.shell`이 1040px에서 고정되므로 뷰포트가 1072px 이상이면 안쪽 배치는 폭과 무관하게 같다
  const screens = Object.entries(browser.layout);
  console.log(`viewport ${screens[0]?.[1].vw}px`);
  for (const [phase, view] of screens) {
    const empty = view.cols.filter(({ width }) => width <= 0).map(({ cls }) => cls);
    // 2열 격자에 패널이 하나뿐이면 오른쪽 칸이 통째로 빈다. 폭 0짜리 자식은 없으므로 개수로 잡는다
    const halfEmpty = view.twoColumn && view.cols.length < 2;
    const widths = view.cols.map(({ cls, width }) => `${cls.split(" ")[0]} ${width}`).join(" · ");
    check(`${phase} 가로 넘침 / 빈 칸`, { overflowX: view.overflowX, empty, halfEmpty }, { overflowX: false, empty: [], halfEmpty: false });
    console.log(`      ${widths}`);
  }
  check("측정한 화면 수", screens.length, phases.length);
  console.log("e2e ok");
} finally {
  server.kill();
}

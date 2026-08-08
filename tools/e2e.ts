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
import { deckOk, deckSize, ruleDeck, run } from "../sim/engine.ts";
import type { ReplayFile } from "../sim/replay.ts";

const port = 5199;
/**
 * 자유 모드 체크포인트가 채우는 카드(아테나 「꿰뚫는 창」, 사거리 `12`). **열 장을 같은 것으로 채우면
 * 아래 시드가 1층에서 끝난다** — 완주가 증명하는 것(엔진 진행)은 덱과 무관하므로 여기서 12층을 다시
 * 걷지 않는다. 중복 열 장이라 「중복 허용」도 같은 클릭이 증명한다.
 * 데이터가 이 카드를 지우거나 tier2로 올리면 `deckOk`가 브라우저를 띄우기 전에 던진다
 */
const freeCard = "card_athena_retry_02";
const freeDeck = Array.from({ length: deckSize }, () => freeCard);
if (!deckOk(freeDeck)) throw new Error(`${freeCard} is no longer a startable tier1 card`);
/**
 * 아래 클릭 정책으로 **12층을 완주하면서** 아홉 결정 phase를 전부 지나는 가장 짧은 시드다(232 결정).
 * 정책이나 콘텐츠가 바뀌면 다시 찾아야 한다 — 800개를 훑는 자리다.
 * P-27에서 141 → 170: 갈래가 격자에서 오면서 옛 시드의 완주가 끊겼다. P-28의 은혜를 지나도 170은 살았다.
 * 427 → 428: 사후 수정이 예고 칸의 빈 방문을 없애면서 요구 하나가 늘었다(R-27 §사후 수정).
 * P-36에서 170 → 589: 밀림이 자리를 옮기고 카드 다섯이 붙자 170이 헌신에 못 닿아 `grace` 화면을 안 지난다.
 * P-39에서 589 → 371: 정예·보스가 tier2 세 자리를 주자 589의 덱이 바뀌어 저승을 지나고 6조우에서 죽는다.
 * P-46에서 371 → 727: 신탁이 결정을 하나 더 끼우고 평온 개입이 조우를 바꾸자 371이 `grace`에 못 닿는다.
 * 이번엔 800개 중 220개가 완주한다(게임이 쉬워졌다) — 784·627·575가 727 다음 후보다
 */
const seed = 727;
const phases = ["path", "card", "target", "rest", "rest_card", "reward", "grace", "demand", "oracle"];

/**
 * 정책은 화면에 적힌 것만 쓴다 — 봇 추천은 DOM에 없고, 있어서도 안 된다. 룰 봇을 브라우저로 옮겨 심지도
 * 않는다(두 번째 진실이 생긴다). 대신 사람이 화면만 보고 낼 법한 최소한의 규칙을 쓴다:
 *
 * - 갈림길: 열린 갈래에 쉼터가 있으면 쉼터, 없으면 첫 칸
 * - 휴식: 첫 번째는 카드 제거(그래야 `rest_card`를 지난다), 두 번째는 강화, 이후는 회복
 * - 요구: 수락
 * - 신탁: 첫 칸(묻는 신 쪽으로 기운다) — 요구와 같은 `button.choice`고 둘 다 값이 붙어 있다(P-46)
 * - 은혜: 첫 후보 — 3택1이 카드가 아니라 `button.choice` 셋이 됐다(P-28). 빈 슬롯이 먼저 서므로 첫 칸이다
 * - 표적: 체력이 가장 낮은 적 — 동점이면 화면 순서
 * - 카드·보상·제거: 캡션에 적힌 비용이 가장 높은 것, 동점이면 표시된 피해, 그래도 같으면 카드 id
 *
 * "누를 수 있는 첫/마지막 카드"는 최악의 정책이라 400시드 중 완주가 하나도 없었다. 완주 없는 E2E는
 * 결과 화면과 반출을 지나지 못하므로 B-0 4번을 증명하지 못한다.
 */
const browserScript = `
// 시드 입력이 화면에서 사라졌다(P-56) — 재현은 URL 쿼리가 든다. 자유 덱 2회차도 같은 시드로 돈다
const tab = await openTab("http://localhost:${port}/?seed=${seed}");
await tab.bringToFront();
// 타이틀 화면은 페이지당 한 번이다 — 아래 「다시 시작」 체크포인트는 setup으로 곧장 돌아온다
await tab.waitForSelector("[data-phase='intro']");
await tab.click(".intro-menu button.primary");
await tab.waitForSelector("[data-phase='setup']");

/**
 * 조합은 기본값이 이미 제우스+아테나다 — 껐다 켜야 토글과 「둘 아니면 못 시작」을 실제로 지난다.
 * 그러면 고른 순서가 아테나→제우스가 되므로 정렬(§P-38)이 빠진 날 아래 완주 기준선이 어긋난다
 */
const setup = await tab.evaluate(async () => {
  const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
  // 덱 편집기의 신 탭이 같은 버튼 줄(.god-legend)을 쓴다 — 접근 이름으로 조합 쪽만 집는다
  const picker = "[aria-labelledby='patron-pick'] button";
  const god = (name) => [...document.querySelectorAll(picker)].find((el) => el.textContent.trim() === name);
  const submit = () => document.querySelector("form.setup button.primary");
  god("제우스").click();
  await wait();
  const blocked = submit().disabled;
  god("제우스").click();
  await wait();
  return { gods: [...document.querySelectorAll(picker)].length, blocked, ready: !submit().disabled,
    picked: [...document.querySelectorAll(picker + "[aria-pressed='true']")].map((el) => el.textContent.trim()),
    // 덱 편집기가 접혀 있으므로 시작 화면은 아직 한 눈금이다. 펼친 뒤는 스크롤을 허용한다
    tall: document.documentElement.scrollHeight > window.innerHeight };
});

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

  /**
   * 비용과 피해는 **버튼의 dataset에서** 읽는다(백틱은 이 스크립트가 템플릿 문자열이라 못 쓴다).
   * 카드 면이 비용을 젬으로 옮긴 뒤로 캡션에는 이름만 있다 — 문구를 정규식으로 긁던 옛 코드는
   * **실패하지 않고** 149장 전부 -1을 돌려주므로 통과한 게이트가 조용히 다른 것을 재게 된다.
   * 값은 ui/card.tsx가 관측값에서 그대로 얹는다
   */
  const cardCost = (button) => Number(button.dataset.cost ?? -1);
  const cardDamage = (button) => Number(button.dataset.damage ?? 0);
  const enemyHp = (button) => Number(button.querySelector(".hp small")?.textContent.split("/")[0] ?? 0);
  /** 비용 → 피해 → id 순의 전순서. 화면 순서에 기대지 않아야 CLI 쪽 기대값과 어긋나지 않는다 */
  const bestCard = () => enabled("button.game-card").sort((left, right) =>
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
  /** 두 번째 런(자유 모드)이 첫 런의 결정열 위에 쌓이지 않게 한다. 화면 기하는 첫 런 것을 그대로 둔다 */
  driver.restart = () => { driver.order = []; driver.rests = 0; };
  /**
   * 반출 버튼을 누르고 Blob 내용을 읽는다 — 즉시 revoke되므로 URL이 아니라 Blob 자체를 잡는다.
   * 앵커 클릭은 삼킨다: 파일을 사용자 다운로드 폴더에 떨어뜨리지 않고도 반출물은 그대로 검사된다
   */
  driver.exportReplay = async () => {
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
    return { filename, replay: JSON.parse(await blobs[0].text()) };
  };
  driver.slice = async (count) => {
    for (let done = 0; done < count; done += 1) {
      const { phase, step } = state();
      if (phase === "result") return { done: true, decisions: driver.order.length };
      driver.order.push(phase);
      driver.layout[phase] ??= measure(section());
      const choices = phase === "path"
        // 갈래가 격자에서 온다(P-42). 쉼터 우선은 반드시 남긴다 — driver.rests가 방문 횟수에
        // 걸려 있어 우선순위가 바뀌면 런의 모양이 바뀌고 CLI ↔ 브라우저가 다른 경로를 비교한다
        ? [document.querySelector("button.map-node.open.rest") ?? enabled("button.map-node.open")[0]]
        : phase === "rest"
        // 제거 → 강화 → 회복 순. 백틱은 이 스크립트가 템플릿 문자열이라 못 쓴다.
        // 강화 칸이 안 서는 덱이면 회복으로 떨어진다 — 화면이 실은 답만 누른다
        ? [enabled("button.choice")[[1, 2][driver.rests++] ?? 0] ?? enabled("button.choice")[0]]
        : phase === "demand" || phase === "grace" || phase === "oracle"
        ? [enabled("button.choice")[0]]
        : phase === "target"
        ? enabled("button.enemy").sort((left, right) => enemyHp(left) - enemyHp(right))
        : phase === "card"
        // 「턴 종료」는 무대 우하단의 케니 버튼이다(P-55) — 패널이 사라져 클래스로 집는다
        ? bestCard().concat(enabled("button.end-turn"))
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
  const { filename, replay } = await window.__e2e.exportReplay();
  const summary = {};
  for (const article of document.querySelectorAll(".summary-grid article")) {
    summary[article.querySelector("small").textContent] = Number(article.querySelector("strong").textContent);
  }
  return {
    order: window.__e2e.order,
    layout: window.__e2e.layout,
    filename,
    replay,
    won: document.querySelector(".result-layout h1").textContent === "승리",
    eyebrow: document.querySelector(".result-layout .eyebrow").textContent,
    floors: Number(document.querySelector(".result-layout .eyebrow").textContent.match(/· (\\d+)\\/12층/)[1]),
    summary,
  };
});

/**
 * 자유 모드 체크포인트. 같은 탭에서 「다시 시작」으로 돌아가 **편집기만** 지나간다 — 완주는 위에서
 * 이미 증명했고, 이 열 장은 1층에서 끝나므로 스무 남짓 결정이면 결과 화면과 반출에 닿는다
 */
await tab.click(".result-layout .actions button:not(.primary)");
await tab.waitForSelector("[data-phase='setup']");

const editor = await tab.evaluate(async () => {
  const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
  const submit = () => document.querySelector("form.setup button.primary");
  const slots = () => [...document.querySelectorAll(".deck-slots .game-card")];
  const ids = () => slots().map((el) => el.dataset.card);
  // 접힘이 기본이다 — 열지 않으면 시작 화면 높이가 그대로라는 것이 이 한 줄로 드러난다
  const details = document.querySelector("details.deck-editor");
  const collapsed = !details.open;
  details.open = true;
  await wait();
  const ruled = ids();

  // 한 장을 빼면 아홉이라 시작이 막힌다 — 「열 장이 아니면 못 누른다」가 서는 자리다
  slots()[0].click();
  await wait();
  const short = { count: ids().length, blocked: submit().disabled };

  // 되돌리면 규칙 덱이다 — 이 버튼이 없으면 편집기는 한 방향 문이고 아홉 장에서 갇힌다
  document.querySelector("details.deck-editor > button").click();
  await wait();
  const restored = { deck: ids(), ready: !submit().disabled };

  // 신 탭으로 목록을 거르고 같은 카드를 열 번 누른다. 열한째가 가장 오래된 것을 밀어내므로 열 번이면
  // 열 장이 다 그 카드다. React가 다시 그리기 전에 두 번 누르면 두 번째가 옛 덱 위에 얹혀 사라진다
  [...document.querySelectorAll(".deck-editor .god-legend button")].find((el) => el.textContent.trim() === "아테나").click();
  await wait();
  for (let click = 0; click < ${deckSize}; click += 1) {
    document.querySelector(".deck-editor .hand button.game-card[data-card='${freeCard}']").click();
    await wait();
  }
  return { collapsed, ruled, short, restored, deck: ids(), ready: !submit().disabled };
});

await tab.click("form.setup button.primary");
await tab.waitForSelector("[data-phase]:not([data-phase='setup'])");
await tab.evaluate(() => window.__e2e.restart());
for (let batch = 0; ; batch += 1) {
  if (batch > 20) throw new Error("free-deck run never reached the result screen");
  const progress = await tab.evaluate(() => window.__e2e.slice(15));
  if (progress.done) break;
}
const free = await tab.evaluate(async () => {
  const { replay } = await window.__e2e.exportReplay();
  return { decisions: window.__e2e.order.length, replay, won: document.querySelector(".result-layout h1").textContent === "승리" };
});

await closeTab(tab);
console.log("__E2E__" + JSON.stringify({ ...captured, setup, editor, free }));
`;

type ScreenBox = { left: number; width: number; gapRight: number } | null;
type ScreenLayout = { vw: number; overflowX: boolean; twoColumn: boolean; layout: ScreenBox; cols: { cls: string; left: number; width: number; gapRight: number }[] };

function browserRun(): {
  order: string[];
  layout: Record<string, ScreenLayout>;
  filename: string;
  replay: ReplayFile;
  won: boolean;
  eyebrow: string;
  floors: number;
  summary: Record<string, number>;
  setup: { gods: number; blocked: boolean; ready: boolean; picked: string[]; tall: boolean };
  editor: {
    collapsed: boolean; ruled: string[]; short: { count: number; blocked: boolean };
    restored: { deck: string[]; ready: boolean }; deck: string[]; ready: boolean;
  };
  free: { decisions: number; replay: ReplayFile; won: boolean };
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
  const cli = run(seed, undefined, browser.replay.actions, browser.replay.patrons);

  console.log(`clicked ${browser.order.length} decisions in the browser`);
  // 다섯 중 둘 — 하나만 남으면 시작이 막히고, 되돌리면 다시 열린다. `tall`은 접힌 편집기가 지키는 눈금이다
  check("조합 선택", browser.setup, { gods: 5, blocked: true, ready: true, picked: ["제우스", "아테나"], tall: false });
  check("phases", [...new Set(browser.order)].sort(), [...phases].sort());
  // 종류 집합만 보면 순서가 뒤집히거나 라벨이 바뀌어도 통과한다 — 누른 순서 그대로 반출됐는지 본다.
  // 215개를 다 찍으면 로그를 못 읽으므로 어긋난 첫 자리만 남긴다
  const exported = browser.replay.actions.map(({ type }) => type);
  const diverged = browser.order.findIndex((phase, index) => exported[index] !== phase);
  check("반출 순서", { diverged, length: exported.length }, { diverged: -1, length: browser.order.length });
  check("filename", browser.filename, `god-scales-run-${seed}.json`);
  // 조합이 반출에 없으면 이 파일은 조용히 제우스+아테나로 재생된다 — 다른 조합에서는 다른 게임이 된다
  check("replay header", { seed: browser.replay.seed, mode: browser.replay.replay_mode, patrons: browser.replay.patrons }, { seed, mode: "action_log", patrons: ["zeus", "athena"] });
  // 「시드 N」이 화면에서 사라졌다(P-54) — 시드는 반출 파일명·헤더 대조(위)가 계속 지킨다
  check("결과 조합", browser.eyebrow, `제우스 + 아테나 · ${browser.floors}/12층`);
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
  // 사람이 고른 것과 봇이 고른 것이 실제로 다르다 — 같으면 위 비교가 아무것도 증명하지 않는다.
  // `run(seed)`는 기본 조합으로 돈다: 브라우저도 제우스+아테나를 고르므로 같은 조합끼리의 대조다.
  // 브라우저가 고르는 조합을 바꾸는 날 이 줄은 조용히 「조합이 다르다」를 재는 것이 된다
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

  /**
   * 자유 모드. 위 완주는 편집기를 **안 열었으므로** 반출에 `deck`이 없고, 그래서 기준선이 그대로다 —
   * 그 대조가 이 아래 검사의 절반이다. 나머지 절반은 「짠 열 장이 그대로 재생된다」다
   */
  const { editor, free } = browser;
  console.log(`clicked ${free.decisions} decisions with a hand-built deck`);
  // 접힘이 기본 · 기본값은 규칙 덱 그대로 · 한 장 빼면 아홉이고 시작이 막힌다 · 채우면 다시 열린다
  check("편집기 기본값", { collapsed: editor.collapsed, ruled: editor.ruled }, { collapsed: true, ruled: ruleDeck(["zeus", "athena"]) });
  check("열 장이 아니면 시작 못 함", editor.short, { count: deckSize - 1, blocked: true });
  // 손댄 것을 되돌리는 길. 조합을 하나로 줄여 슬롯을 비운 사람도 여기로 나온다
  check("규칙 덱으로 되돌린다", editor.restored, { deck: ruleDeck(["zeus", "athena"]), ready: true });
  check("짠 덱", { deck: editor.deck, ready: editor.ready }, { deck: freeDeck, ready: true });
  // 고정 모드 반출에는 `deck`이 없어야 한다 — 있으면 편집기가 안 건드린 런까지 자유 모드로 적는다
  check("고정 모드 반출에 deck 없음", browser.replay.deck, undefined);
  check("자유 모드 반출의 deck", free.replay.deck, freeDeck);
  // 그 열 장으로 CLI가 같은 게임을 재생한다. `deck`을 안 넘기면 규칙 덱이 되어 여기서 갈린다
  const freeCli = run(seed, undefined, free.replay.actions, free.replay.patrons, free.replay.deck);
  check("자유 덱 재생", { substituted: freeCli.substituted, won: freeCli.won }, { substituted: 0, won: free.won });
  console.log("e2e ok");
} finally {
  server.kill();
}

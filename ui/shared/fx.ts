import { playVoice } from "./sfx.ts";

/**
 * 컷인이 든 문장 한 줄. **그림은 「신이 뭔가 했다」까지만 말한다** — 무엇을 했는지, 도와준 건지
 * 방해한 건지는 이 줄이 든다. 신 색은 `--{id}`, 단계 색은 미터가 쓰는 `--stage-{단계}` 그대로다
 */
export type CutLabel = { god: string; stage: string; title: string; text: string };

/**
 * 파티클은 0.8초, 컷인 그림은 1.6초 띄웠다 지운다. 개입 HUD는 그림과 갈라 3초 남는다.
 * `kind`는 크기만 가른다 — `cut`은 화면 전체, `spark`는 `host` 가운데 한 장이다
 */
export async function playSprite(host: HTMLElement, source: string, kind: "cut" | "spark" = "cut", label?: CutLabel): Promise<void> {
  const image = new Image();
  const loaded = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = source;
  if (!await loaded) return;
  const effect = document.createElement("span");
  const strip = image.naturalWidth / image.naturalHeight >= 4;
  effect.className = `fx ${kind}${strip ? " strip" : ""}${label ? ` ${label.stage}` : ""}`;
  const view = document.createElement("span");
  view.className = "fx-view";
  view.append(image);
  effect.append(view);
  let caption: HTMLElement | undefined;
  if (label) {
    const notice = document.createElement("span");
    notice.className = "fx-caption";
    notice.setAttribute("role", "status");
    notice.style.setProperty("--god-color", `var(--${label.god})`);
    const title = document.createElement("small");
    title.textContent = label.title;
    const line = document.createElement("b");
    line.textContent = label.text;
    notice.append(title, line);
    effect.append(notice);
    caption = notice;
  }
  host.append(effect);
  /**
   * **개입 HUD는 애니메이션이 아니라 정보다.** 모션을 끄면 페이드 없이 3초 머문다 — 안 그러면 접근성
   * 설정 하나가 「신이 무엇을 했는가」를 알 길을 통째로 지운다. 문장 없는 파티클은 여기 안 걸린다
   */
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const still = label !== undefined && reduced;
  const fade = label
    ? Promise.all([
      view.animate(
        still ? [{ opacity: 1 }, { opacity: 1, offset: .999 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .75 }, { opacity: 0 }],
        { duration: 1600, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
      ).finished,
      caption!.animate(
        still ? [{ opacity: 1 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateX(8px)" }, { opacity: 1, transform: "none", offset: .1 }, { opacity: 1, transform: "none", offset: .88 }, { opacity: 0, transform: "translateX(8px)" }],
        { duration: 3000, easing: "linear" },
      ).finished,
    ])
    : effect.animate(
      [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }],
      { duration: 800, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    ).finished;
  const frames = strip && !reduced
    ? image.animate(
      [{ transform: "translate(0, -50%)" }, { transform: "translate(-100%, -50%)" }],
      { duration: 800, easing: "steps(4, jump-end)" },
    ).finished
    : Promise.resolve();
  await Promise.all([fade, frames]);
  effect.remove();
}

/**
 * 화면 흔들림. **흔드는 것은 `body`가 아니라 `.shell`이다** — `body`에 `transform`을 걸면 그만큼이
 * 뷰포트의 가로 스크롤 영역이 되어 `documentElement.scrollWidth > innerWidth`가 흔드는 동안 참이
 * 된다(R-52·R-57·R-58이 세 번 본 「reward 가로 넘침」 플레이크의 자리다). `.shell`은 1040px 고정에
 * 좌우 여백이 있어(`zoom`이 줄여도 비율이 같다) ±10px이 판 밖으로 안 나간다
 */
export function shake(distance: number, duration: number): void {
  document.querySelector(".shell")?.animate(
    [{ transform: `translateX(-${distance}px)` }, { transform: `translateX(${distance}px)` }, { transform: "none" }],
    { duration, easing: "ease-in-out" },
  );
}

/**
 * 발화 셋. **빈도가 셋을 정했다** — 개입 턴은 런당 약 49회고 카드가 찢기는 순간은 0~10회다. 49회와
 * 5회가 같은 연출이면 하나는 피로하고 하나는 밋밋하다. 그 사이가 2단계로는 안 나온다
 */
export type VoiceLevel = 1 | 2 | 3;
/** 화면을 가리지 않는 상단 발화(L2·L3)는 모두 읽을 시간 4초를 준다. */
const voiceHold = 4000;
/** 개입(L1)은 자막이 아니라 우측 알림 피드다 — 런당 ~49회라 짧게 스치고, 결과는 HP·칩에 남는다. */
const hudHold = 3000;
const spokenLines = new Set<string>();

export function resetSpokenLines(): void {
  spokenLines.clear();
}

export function nextSpokenLine(god: string, text: string | readonly string[]): string {
  const candidates = typeof text === "string" ? [text] : text;
  const line = candidates.find((candidate) => candidate && !spokenLines.has(`${god}\0${candidate}`)) ?? "";
  if (line) spokenLines.add(`${god}\0${line}`);
  return line;
}

/**
 * 신이 한 마디 한다. **셋 다 입력을 받지 않는다** — 「클릭해서 넘기는 대화창」이면 `Decision`이 하나
 * 늘고 replay 형식이 바뀌고 봇이 그것에 답해야 하고 `npm run e2e`의 「반출 → CLI 재생 일치」가 깨진다.
 * 여기 클릭은 **넘기기만** 하고 기록되지 않는다: 화면 상태고 게임 상태가 아니다.
 *
 * 겹치면 **큐가 아니라 순서**다 — 상단 배너(L2·L3)는 새 발화가 낮거나 같은 레벨을 지우고 선다(같은
 * 자리에 두 장이 서면 글자가 겹친다). 우측 피드(L1)는 지우는 대신 최대 2장을 쌓는다 — 개입 2연타를
 * 놓치지 않기 위해서다. 같은 레벨끼리는 호출자가 320ms 어긋나게 낸다(P-46의 컷인과 같은 규칙)
 */
export function speak(level: VoiceLevel, god: string, text: string | readonly string[], portrait?: string): void {
  // 더 높은 레벨이 서 있으면 자막은 아예 안 뜬다 — 「높은 것이 낮은 것을 덮는다」의 나머지 절반이다
  for (const older of document.querySelectorAll<HTMLElement>(".voice")) {
    if (Number(older.dataset.level) > level) return;
  }
  const selected = nextSpokenLine(god, text);
  if (!selected) return;
  playVoice(god, selected);
  if (level === 1) {
    intervene(god, selected, portrait);
    return;
  }
  for (const older of document.querySelectorAll<HTMLElement>(".voice")) older.remove();
  const line = document.createElement("div");
  line.className = `voice l${level}`;
  line.dataset.level = String(level);
  line.style.setProperty("--god-color", `var(--${god})`);
  if (portrait) {
    const image = new Image();
    image.src = portrait;
    image.alt = "";
    line.append(image);
  }
  const body = document.createElement("b");
  body.textContent = selected;
  line.append(body);
  line.addEventListener("pointerdown", () => line.remove());
  document.body.append(line);
  /**
   * **말은 애니메이션이 아니라 정보다.** 모션을 끄면 페이드 없이 제 시간만큼 머문다 — `playSprite`의
   * 문장과 같은 규칙이다. 화면 흔들림은 외침에만 붙고 줄인 모션에서는 통째로 빠진다
   */
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (level === 3 && !still) shake(10, 220);
  void line.animate(
    still
      ? [{ opacity: 1 }, { opacity: 1 }]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }],
    { duration: voiceHold, easing: "linear" },
  ).finished.then(() => line.remove());
}

/**
 * 개입 한 줄이 우측 피드에 선다. 자막(대화)과 다른 문법이다 — 클릭도 안 받고(`pointer-events: none`)
 * 놓쳐도 되는 알림이라, 연출을 꺼도 제 시간만큼 서 있기만 하면 정보가 안 사라진다
 */
function intervene(god: string, selected: string, portrait?: string): void {
  let feed = document.querySelector<HTMLElement>(".god-hud");
  if (!feed) {
    feed = document.createElement("div");
    feed.className = "god-hud";
    document.body.append(feed);
  }
  const entry = document.createElement("div");
  entry.style.setProperty("--god-color", `var(--${god})`);
  if (portrait) {
    const image = new Image();
    image.src = portrait;
    image.alt = "";
    entry.append(image);
  }
  const body = document.createElement("b");
  body.textContent = selected;
  entry.append(body);
  feed.prepend(entry);
  while (feed.childElementCount > 2) feed.lastElementChild?.remove();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  void entry.animate(
    still
      ? [{ opacity: 1 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "translateX(12px)" },
          { opacity: 1, transform: "none", offset: 0.08 },
          { opacity: 1, offset: 0.9 },
          { opacity: 0 },
        ],
    { duration: hudHold, easing: "linear" },
  ).finished.then(() => entry.remove());
}

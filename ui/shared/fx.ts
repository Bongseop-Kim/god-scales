/**
 * 컷인이 든 문장 한 줄. **그림은 「신이 뭔가 했다」까지만 말한다** — 무엇을 했는지, 도와준 건지
 * 방해한 건지는 이 줄이 든다. 신 색은 `--{id}`, 단계 색은 미터가 쓰는 `--stage-{단계}` 그대로다
 */
export type CutLabel = { god: string; stage: string; text: string };

/**
 * 한 장이나 4프레임 스트립을 0.8초 띄웠다 지운다. `kind`는 크기만 가른다 — `cut`은 화면 전체(개입 컷인·신 일러),
 * `spark`는 `host` 가운데 한 장(카드 파티클·개입이 때린 대상)이다. 파티클 엔진도 풀도 만들지 않는다
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
  if (label) {
    const line = document.createElement("b");
    line.style.setProperty("--god-color", `var(--${label.god})`);
    line.textContent = label.text;
    effect.append(line);
  }
  host.append(effect);
  /**
   * **문장은 애니메이션이 아니라 정보다.** 모션을 끄면 페이드 없이 3초 머문다 — 안 그러면 접근성
   * 설정 하나가 「신이 무엇을 했는가」를 알 길을 통째로 지운다. 문장 없는 파티클은 여기 안 걸린다
   */
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const still = label !== undefined && reduced;
  const fade = effect.animate(
    still
      ? [{ opacity: 1 }, { opacity: 1 }]
      : label
        ? [{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }],
    { duration: still ? 3000 : label ? 1600 : 800, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
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
/** 머무는 시간. 자막은 짧고 외침은 길다 — 타이핑 애니메이션을 안 넣는 이유가 1.2초다 */
const voiceHold: Record<VoiceLevel, number> = { 1: 1200, 2: 2000, 3: 3000 };
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
 * 겹치면 **큐가 아니라 순서**다 — 새 발화가 낮거나 같은 레벨을 지우고 선다(같은 자리에 두 장이 서면
 * 글자가 겹친다). 같은 레벨끼리는 호출자가 320ms 어긋나게 낸다(P-46의 컷인과 같은 규칙)
 */
export function speak(level: VoiceLevel, god: string, text: string | readonly string[], portrait?: string): void {
  // 더 높은 레벨이 서 있으면 자막은 아예 안 뜬다 — 「높은 것이 낮은 것을 덮는다」의 나머지 절반이다
  for (const older of document.querySelectorAll<HTMLElement>(".voice")) {
    if (Number(older.dataset.level) > level) return;
  }
  const selected = nextSpokenLine(god, text);
  if (!selected) return;
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
      : [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.84 }, { opacity: 0 }],
    { duration: voiceHold[level], easing: "linear" },
  ).finished.then(() => line.remove());
}

import { mapNode } from "../core/map.ts";
import { run } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { cardMarkup } from "./card.ts";
import { downloadReplay } from "./export.ts";
import { playSound, sound } from "./sfx.ts";
import { tokenLegend } from "./tokens.ts";
import "./motion.css";
import "./style.css";

type Screen = "setup" | "map" | "result";

const choiceFloors = ["지하 3층", "지하 5층", "지상 3층", "지상 5층"];
const godColors = [
  ["제우스", "#f2c94c"],
  ["포세이돈", "#43b9d6"],
  ["아테나", "#a8b0c3"],
  ["아레스", "#e45b4f"],
  ["아르테미스", "#75c66a"],
] as const;

export function mountApp(root: HTMLElement): void {
  let screen: Screen = "setup";
  let seed = 1;
  let actions: ReplayAction[] = [];
  let result: RunResult | undefined;

  const reset = () => {
    screen = "setup";
    actions = [];
    result = undefined;
    render();
  };

  const choosePath = (choice: "combat" | "rest") => {
    actions = [...actions, { type: "path", choice }];
    if (actions.length === choiceFloors.length) {
      result = run(seed, undefined, actions);
      screen = "result";
    }
    render();
  };

  const mapMarkup = () => Array.from({ length: 12 }, (_, index) => {
    const node = mapNode(index);
    const optionalIndex = [2, 4, 8, 10].indexOf(index);
    const chosen = optionalIndex >= 0 ? actions[optionalIndex]?.choice : undefined;
    const symbol = node.options[0] === "boss" ? "보" : chosen === "rest" ? "휴" : "전";
    const region = node.region === "underworld" ? "지하" : "지상";
    return `<li class="map-node ${chosen ?? ""}"><span>${symbol}</span>${region} ${node.floor}층</li>`;
  }).join("");

  const render = () => {
    const godLegend = godColors.map(([name, color]) => `<span><i style="--god-color:${color}"></i>${name}</span>`).join("");
    if (screen === "setup") {
      root.innerHTML = `
        <section class="shell setup">
          <p class="eyebrow">결정론적 덱빌딩 프로토타입</p>
          <h1>신들의 저울</h1>
          <p class="lead">제우스와 아테나의 호의를 관리하며 지하에서 지상까지 12층을 돌파하세요.</p>
          <div class="god-legend">${godLegend}</div>
          <div class="token-legend" aria-label="상태 토큰">${tokenLegend()}</div>
          <label class="seed-field">런 시드 <input id="seed" type="number" value="${seed}" step="1" /></label>
          <button class="primary" data-action="start">런 시작</button>
          <button class="sound-toggle" data-action="sound" aria-pressed="${sound.enabled}">${sound.enabled ? "소리 켜짐" : "소리 꺼짐"}</button>
          <p class="hint">전투는 룰 봇이 자동 진행합니다. 당신은 네 번의 갈림길을 결정합니다.</p>
        </section>`;
      return;
    }

    if (screen === "map") {
      const label = choiceFloors[actions.length];
      root.innerHTML = `
        <section class="shell run-layout">
          <header><div><p class="eyebrow">시드 ${seed} · 제우스 + 아테나</p><h1>경로 선택</h1></div><strong>${actions.length + 1} / ${choiceFloors.length}</strong></header>
          <div class="map-panel"><h2>12층 지도</h2><ol>${mapMarkup()}</ol></div>
          <div class="decision-panel">
            <p class="eyebrow">${label}</p>
            <h2>어디로 향할까요?</h2>
            <button class="choice combat" data-path="combat"><span>전</span><b>전투</b><small>보상을 노리고 위험을 감수합니다.</small></button>
            <button class="choice rest" data-path="rest"><span>휴</span><b>휴식</b><small>체력을 회복해 다음 전투를 준비합니다.</small></button>
          </div>
        </section>`;
      return;
    }

    if (!result) throw new Error("result screen requires a completed run");
    const finalFavor = result.favorCurve.at(-1) ?? {};
    const reached = Math.min(12, result.hpCurve.length - 1);
    const recentLog = result.log.slice(-10).map((line) => `<li>${line}</li>`).join("");
    const recentCards = [...new Set(result.cardsPlayed)].slice(0, 3).map(cardMarkup).join("");
    root.innerHTML = `
      <section class="shell result-layout">
        <header><div><p class="eyebrow">시드 ${seed} · ${reached}/12층</p><h1>${result.won ? "승리" : "패배"}</h1></div><span class="outcome ${result.won ? "win" : "loss"}">${result.won ? "균형 유지" : "저울 붕괴"}</span></header>
        <div class="summary-grid">
          <article><small>최종 체력</small><strong>${result.hpCurve.at(-1) ?? 0}</strong></article>
          <article><small>전투 횟수</small><strong>${result.encounters}</strong></article>
          <article><small>제우스 호의</small><strong>${finalFavor.zeus ?? 0}</strong></article>
          <article><small>아테나 호의</small><strong>${finalFavor.athena ?? 0}</strong></article>
        </div>
        <div class="result-columns">
          <div class="map-panel"><h2>선택한 경로</h2><ol>${mapMarkup()}</ol></div>
          <div class="combat-log"><h2>전투 기록</h2><div class="used-cards">${recentCards}</div><ol>${recentLog}</ol></div>
        </div>
        <div class="actions"><button class="primary" data-action="export">런 JSON 반출</button><button data-action="reset">다시 시작</button></div>
      </section>`;
  };

  root.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action], [data-path]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "start") {
      const input = root.querySelector<HTMLInputElement>("#seed");
      const nextSeed = Number(input?.value);
      if (!Number.isInteger(nextSeed)) {
        input?.setCustomValidity("정수 시드를 입력하세요.");
        input?.reportValidity();
        return;
      }
      seed = nextSeed;
      screen = "map";
      playSound("start");
      render();
    } else if (action === "export") downloadReplay(seed, actions);
    else if (action === "reset") reset();
    else if (action === "sound") {
      sound.enabled = !sound.enabled;
      render();
    }
    else if (target.dataset.path === "combat" || target.dataset.path === "rest") choosePath(target.dataset.path);
  });

  root.addEventListener("error", (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.closest(".card-art")) image.closest(".card-art")?.classList.add("missing");
  }, true);

  render();
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/app.tsx";

const app = document.querySelector("#app");

if (!app) throw new Error("#app is missing");

/**
 * 그림 다섯 자리(카드·배경·프롭·적·주인공)를 끌면 브라우저가 고스트를 만든다. `ui/style.css`의
 * `-webkit-user-drag`는 Chromium·WebKit만 먹으므로 **Firefox는 이 줄이 없으면 그대로 뜯긴다.**
 * `<img>`마다 `draggable={false}`를 다는 것보다 짧고, 나중에 붙는 여섯 번째 그림도 자동으로 든다
 */
addEventListener("dragstart", (event) => event.preventDefault());

/**
 * 좁은 창에서는 `.shell`을 **통째로 줄인다.** 1을 넘겨 키우지 않는 이유는 픽셀아트라서다 —
 * 140px 카드 그림과 16px 마커는 정수배가 아닌 확대가 곧 손상이다. 1072 = 1040 + 좌우 16px 숨통.
 * 높이도 잰다 — 루트가 `overflow: clip`이라 낮은 창에서는 줄이지 않으면 하단(손패·턴 종료)이
 * 소리 없이 잘린다. 900 = 가장 큰 고정 높이 화면(전투)의 최소 세로
 */
const fit = () => document.documentElement.style.setProperty("--fit", String(Math.min(1, innerWidth / 1072, innerHeight / 900)));
fit();
addEventListener("resize", fit);

/**
 * 개발·e2e용 고정 시드(P-56) — 시드 입력이 화면에서 사라졌으므로 재현이 필요한 쪽은 URL로 넘긴다.
 * `?seed=727` 없이 열면 App이 런마다 새로 뽑고, 반출 JSON에는 그대로 남는다
 */
const urlSeed = Number(new URLSearchParams(location.search).get("seed"));

createRoot(app).render(
  <StrictMode>
    <App seed={Number.isInteger(urlSeed) && urlSeed > 0 ? urlSeed : undefined} />
  </StrictMode>,
);

import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { StatsPayload } from "./sim/stats.ts";
import { StatsPage } from "./ui/stats.tsx";
import "./ui/style.css";
import "./ui/stats.css";

const app = document.querySelector("#app");
if (!app) throw new Error("#app is missing");
const root = createRoot(app);
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

/** 데이터는 CI가 만든다(`npm run stats` → `public/stats.json`). 없으면 페이지가 아니라 데이터가 없는 것 */
fetch("./stats.json")
  .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
  .then((data: StatsPayload) => render(<StatsPage data={data} />))
  .catch(() => render(<p className="stats-missing"><code>stats.json</code>이 없습니다 — <code>npm run stats</code>를 먼저 돌리세요.</p>));

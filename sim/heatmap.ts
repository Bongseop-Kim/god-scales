import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { run, simulateStratified } from "./engine.ts";
import { summarize } from "./report.ts";

// ponytail: reports/final.md is a hand-written document now, not a template with holes in it.
if (process.argv.includes("--compare")) {
  const results = readdirSync("decisions", { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => {
    try {
      const stored = JSON.parse(readFileSync(`decisions/${entry.name}/result.json`, "utf8"));
      const patrons = stored.pairing.split("+") as import("./engine.ts").PatronPair;
      const current = run(Number(stored.run_id), undefined, stored.actions, patrons);
      const refreshed = { ...stored, won: current.won, fusion_rate: current.fused ? 1 : 0 };
      writeFileSync(`decisions/${entry.name}/result.json`, `${JSON.stringify(refreshed, null, 2)}\n`);
      return [refreshed];
    } catch { return []; }
  });
  const rule = simulateStratified(1000);
  const relationship = (pairing: string) => ["zeus+poseidon", "athena+ares"].includes(pairing) ? "rival" : pairing.includes("artemis") ? "artemis" : "non_rival";
  const gap = (values: { pairing: string; won: boolean }[]) => {
    const rate = (kind: string) => {
      const group = values.filter(({ pairing }) => relationship(pairing) === kind);
      return group.length ? group.filter(({ won }) => won).length / group.length : 0;
    };
    return rate("rival") - rate("non_rival");
  };
  const comparison = {
    runs_by_actor: { rule_bot: rule.length, llm_agent: results.length },
    fusion_rate: { rule_bot: rule.filter(({ fused }) => fused).length / rule.length, llm_agent: results.filter(({ fusion_rate }) => fusion_rate > 0).length / (results.length || 1) },
    rival_gap: { rule_bot: gap(rule as { pairing: string; won: boolean }[]), llm_agent: gap(results) },
    agent_fallbacks: results.reduce((sum, result) => sum + result.fallbacks, 0) / (results.reduce((sum, result) => sum + result.decisions, 0) || 1),
    division_of_labor: "에이전트는 전략 층만 근사한다. 전투 층의 체감은 합성 플레이테스트가 답한다.",
    unavailable_phases: ["요구 선택", "전투 보상", "은혜 3택1"],
  };
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/actor-comparison.json", `${JSON.stringify(comparison, null, 2)}\n`);
  console.log(JSON.stringify(comparison, null, 2));
} else {
  const report = summarize(simulateStratified(2000));
  const gods = ["zeus", "poseidon", "athena", "ares", "artemis"];
  const cell = 100;
  const offset = 120;
  const color = (value: number | null) => value === null ? "#202636" : `hsl(${Math.round(value * 120)} 55% 42%)`;
  const cells = gods.flatMap((row, y) => gods.map((column, x) => {
    const value = report.win_rate_matrix[row][column];
    return `<rect x="${offset + x * cell}" y="${offset + y * cell}" width="${cell - 2}" height="${cell - 2}" rx="6" fill="${color(value)}"/><text x="${offset + x * cell + cell / 2}" y="${offset + y * cell + 56}" text-anchor="middle" fill="white">${value === null ? "—" : `${(value * 100).toFixed(1)}%`}</text>`;
  })).join("");
  const labels = gods.map((god, index) => `<text x="${offset + index * cell + cell / 2}" y="95" text-anchor="middle">${god}</text><text x="105" y="${offset + index * cell + 56}" text-anchor="end">${god}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="650" height="650" viewBox="0 0 650 650"><rect width="100%" height="100%" fill="#10131a"/><g fill="#dce2ef" font-family="system-ui" font-size="14">${labels}${cells}<text x="325" y="35" text-anchor="middle" font-size="22">신 조합 승률 행렬 · v1</text></g></svg>`;

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/heatmap-v1.svg", svg);
  writeFileSync("reports/round-1.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(`reports/heatmap-v1.svg stddev=${report.pairing_win_stddev.toFixed(3)}`);
}

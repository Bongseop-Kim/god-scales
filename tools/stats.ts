import { writeFileSync } from "node:fs";
import { simulateStratified } from "../sim/engine.ts";
import { computeStats } from "../sim/stats.ts";

/**
 * `stats.html`이 읽는 데이터. **CI가 매 빌드 생성하므로 커밋하지 않는다**(.gitignore) —
 * 층화 시드가 고정이라 같은 코드·데이터면 같은 파일이 나온다. 2000은 조합당 200시드로,
 * 밴드 테스트가 이미 감당하는 규모다
 */
const stats = computeStats(simulateStratified(2000));
writeFileSync("public/stats.json", `${JSON.stringify(stats)}\n`);
console.log(`public/stats.json runs=${stats.meta.runs} win_rate=${stats.meta.winRate} steps=${stats.favor.steps}`);

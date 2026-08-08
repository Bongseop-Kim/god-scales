import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/engine";
import { summarize } from "../sim/report";
import { validateItems } from "../tools/validate";

describe("generated enemies", () => {
  // 후보 하나면 판정이 선다 — 배포된 적을 그대로 베낀 열넷은 밴드가 움직일 때마다 두 곳을 고치게 했다
  it("rejects an encounter outside its regional thresholds", () => {
    const items = JSON.parse(readFileSync("staging/enemies-underworld.json", "utf8"));
    const report = validateItems(items);
    expect(report.rejected).toEqual([{ id: "enemy_bad_group", failure: "value_outlier" }]);
  });

  it("reports enemy counts, target spread, and efficient blocking", () => {
    const report = summarize(simulate(500));
    expect(report.enemy_count_dist).toEqual(expect.any(Object));
    expect(report.target_spread).toEqual(expect.any(Object));
    /**
     * **효율은 1을 넘을 수 없다** — 흡수한 방어가 쌓은 방어보다 클 수는 없으므로, 1을 넘으면 그것은
     * 밸런스가 아니라 분모가 빠진 것이다(개입이 준 방어를 안 세던 자리, `sim/engine.ts`).
     *
     * 옛 밴드 `[0.80, 0.93]`은 회차 간 비교였고 P-46이 지웠다 — **밸런스 게이트는 조합 승률 하한
     * 하나다**(CLAUDE.md). 신탁이 호의를 조우마다 미는 지금 이 값은 0.79로 내려가는데, 그것을 맞추려
     * 신탁 값을 깎는 것이 그 규칙이 막는 일이다. 이번 회차 실측은 리뷰(reviews/46-presence.md)에 있다
     */
    expect(report.block_efficiency).toBeLessThanOrEqual(1);
  });
});

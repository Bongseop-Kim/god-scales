import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("frozen parameter versions", () => {
  it("freezes versions and keeps absorbed block structurally valid", () => {
    const report = summarize(simulateStratified(2000));
    expect(report.bot_policy_version).toBe("v9");
    expect(report.global_param_version).toBe("v9");
    /**
     * **구조 불변식이지 밴드가 아니다** — 흡수한 방어가 쌓은 방어보다 클 수 없으므로 1을 넘으면
     * 그것은 밸런스가 아니라 **분모가 빠진 것**이고, 그게 이 숫자가 원래 지키던 것이다
     * (`sim/engine.ts`의 「개입이 준 방어도 쌓은 방어다」).
     *
     * 수치 밴드는 두지 않는다. 밸런스 게이트는 `test/matrix.test.ts`의 조합 승률 하한 하나다.
     */
    expect(report.block_efficiency).toBeLessThanOrEqual(1);
  });
});

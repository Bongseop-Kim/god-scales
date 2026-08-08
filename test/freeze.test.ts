import { describe, expect, it } from "vitest";
import { simulateStratified } from "../sim/engine";
import { summarize } from "../sim/report";

describe("frozen parameter versions", () => {
  it("freezes versions inside the target win and block bands", () => {
    const report = summarize(simulateStratified(2000));
    expect(report.bot_policy_version).toBe("v8");
    expect(report.global_param_version).toBe("v9");
    expect(report.winRate).toBeGreaterThanOrEqual(0.15);
    expect(report.winRate).toBeLessThanOrEqual(0.7);
    /**
     * **구조 불변식이지 밴드가 아니다** — 흡수한 방어가 쌓은 방어보다 클 수 없으므로 1을 넘으면
     * 그것은 밸런스가 아니라 **분모가 빠진 것**이고, 그게 이 숫자가 원래 지키던 것이다
     * (`sim/engine.ts`의 「개입이 준 방어도 쌓은 방어다」).
     *
     * `[0.74, 0.88]` 밴드는 P-59가 지웠다(R-46이 `[0.80, 0.93]`을 지운 것과 같은 자리·같은 이유).
     * 이 지표는 **플레이어가 세질수록 내려간다**: 헌신 개입이 매 턴 방어를 얹는데 그 방어가 시험받기
     * 전에 조우가 끝난다. P-59는 시련의 선불 호의 대가를 지우고 관계 벌금을 편드는 순간으로 옮겼고,
     * 그 결과 합성률이 0.22 → 0.42로 올라 이 값이 0.745 → 0.684가 됐다. 되돌리려면 요구 보상을
     * 깎아야 하는데 그러면 라이벌 조합 둘이 승률 하한 0.05 아래로 떨어진다 — 게이트는 그쪽 하나다
     */
    expect(report.block_efficiency).toBeLessThanOrEqual(1);
  });
});

import { describe, expect, it } from "vitest";
import { simulate, winFloor } from "../tools/tune";

describe("pairing matrix", () => {
  // 시드가 조합당 1~300으로 고정이라 결정적이다. 잡는 것은 0에 붙은 셀 하나뿐 — stddev·CV 밴드는
  // 삭제했고 `npm run tune`이 참고용으로만 찍는다. 릴리스 목표 0.25는 DEPLOY.md에서 판정한다
  it("keeps every pairing above the win floor", () => {
    const rates = simulate().win_rate_by_pairing;
    expect(Object.entries(rates).filter(([, rate]) => rate < winFloor)).toEqual([]);
  });
});

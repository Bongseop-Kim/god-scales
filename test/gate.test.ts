import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateItems } from "../tools/validate";

describe("validation gate", () => {
  it("routes every broken fixture to its filter", () => {
    const directory = "core/__fixtures__/broken";
    const items = readdirSync(directory).sort().map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")));
    const report = validateItems(items);
    expect(report.rejected.map(({ failure }) => failure)).toEqual([
      "schema",
      "dsl_parse",
      "token_scope",
      "token_scope",
      "fusion_scope",
      "demand_axis",
      "duplicate",
      "value_outlier",
      // target=self 카드가 적 토큰을 붙이면 그 디버프는 플레이어에게 걸린다
      "token_scope",
      // 없는 이름을 적은 패시브는 어떤 훅도 읽지 않는다
      "passive_coverage",
      // 없는 훅에 걸린 파워는 영원히 발동하지 않는다
      "dsl_parse",
    ]);
  });

  // 커버리지가 비면 그 패시브의 훅은 아무도 부르지 않는 코드다 — 목록만 내면 다음 회차에 조용히 생긴다
  it("wires every passive to a shipped enemy", () => {
    const enemies = JSON.parse(readFileSync("data/enemies.json", "utf8"));
    expect(validateItems(enemies).passive_coverage).toEqual([]);
  });

  it("accepts valid single-patron and fusion cards", () => {
    const report = validateItems([
      { id: "card_valid_guard", name: "온전한 방어", patron: "athena", cost: 1, target: "self", effects: [{ op: "block", value: 5 }], tags: ["defend"] },
      { id: "card_valid_fusion", name: "온전한 폭풍", patron_pair: ["poseidon", "zeus"], cost: 1, target: "enemy", effects: [{ op: "apply_token", token: "soaked", stacks: 1 }, { op: "damage", value: 5 }, { op: "chain", value: 4 }], tags: ["attack", "fused", "multi"] },
    ]);
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toHaveLength(2);
  });
});

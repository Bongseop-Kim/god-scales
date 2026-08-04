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
    ]);
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

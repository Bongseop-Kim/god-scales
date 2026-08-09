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
      // 시련 단이 수락보다 쉬우면 임계 단조가 뒤집힌 것이다 — 값을 치르고 더 쉬운 조건을 받는다
      "demand_axis",
      // 플레이어에게 붙은 `displace`는 소모 경로가 없다 — 영원히 안 지워지고 아무 일도 안 한다
      "token_scope",
      // 없는 훅에 걸린 파워는 영원히 발동하지 않는다
      "dsl_parse",
      // 2층에 적은 정예는 격자가 놓을 수 없는 자리라 아무도 안 쓰는 데이터다
      "map_layout",
      // 자기를 때리는 개입은 `dealDamage(player, player)`가 되어 `deflect`를 태우고 피해는 그대로 먹는다
      "token_scope",
      // 키는 다 있는데 컨테이너 꼴이 틀린 둘. 반려가 아니라 예외가 나면 그 배치는 판정을 못 받는다
      "schema",
      "schema",
      // 매 턴 훅에 붙은 지속 토큰은 조우 내내 쌓인다 — 5.8턴 × 12조우면 침수 60스택이다
      "token_scope",
    ]);
  });

  // 층 배치가 데이터니까 게이트가 본다 — 층 상한과 「정예는 같은 층 combat보다 세다」 둘 다
  it("keeps every floor slot inside its progression band", () => {
    const slots = JSON.parse(readFileSync("data/map.json", "utf8"));
    const report = validateItems(slots);
    expect(report.rejected).toEqual([]);
    expect(report.unplaced_groups).toEqual([]);
  });

  /**
   * 층이 가리키는 편성은 **배포될 적**의 것이어야 한다. 반려된 적으로 통과한 층은 `--apply`가 쓰고
   * 나면 `encounter()`가 던지는 자리가 된다 — 편성 세기만 보면 밴드 안이라 개별 판정은 통과한다
   */
  it("rejects a floor slot whose group comes from a rejected enemy", () => {
    const enemy = JSON.parse(readFileSync("core/__fixtures__/broken/11-passive.json", "utf8"));
    const slot = {
      id: "map_underworld_borrowed",
      region: "underworld",
      floor: 3,
      text: "반려된 적의 편성을 가리키는 층.",
      groups: { combat: ["group_bad_passive_wall"] },
    };
    const report = validateItems([enemy, slot]);
    expect(report.rejected).toContainEqual({ id: "map_underworld_borrowed", failure: "map_layout" });
  });

  // 커버리지가 비면 그 패시브의 훅은 아무도 부르지 않는 코드다 — 목록만 내면 다음 회차에 조용히 생긴다
  it("wires every passive to a shipped enemy", () => {
    const enemies = JSON.parse(readFileSync("data/enemies.json", "utf8"));
    expect(validateItems(enemies).passive_coverage).toEqual([]);
  });

  // 신·tier마다 후보가 셋이어야 3택1이 선다. 밴드는 tier로 기울고, 완화 비율에는 은혜도 합산된다
  it("keeps every shipped grace inside its tier band and leaves a three-way offer", () => {
    const graces = JSON.parse(readFileSync("data/graces.json", "utf8"));
    const report = validateItems(graces, JSON.parse(readFileSync("data/cards.json", "utf8")));
    expect(report.rejected).toEqual([]);
    expect(report.grace_coverage).toEqual([]);
  });

  /**
   * 카드의 정체성은 **효과의 모양**이다(P-44 §1) — 배포된 `block|draw@self` 열 장 옆에 열한째를
   * 세우는 길은 새 숫자가 아니라 새 모양이어야 한다. 배포분끼리는 다시 재지 않으므로 149장은 그대로 산다
   */
  it("rejects a candidate that only changes the numbers of a shipped card", () => {
    const shipped = JSON.parse(readFileSync("data/cards.json", "utf8"));
    const twin = shipped.find(({ id }: { id: string }) => id === "card_zeus_09");
    const report = validateItems([
      // 값과 코스트만 다른 쌍둥이 — 지문이 값을 3으로 나눠 들던 시절에는 통과했다
      { ...twin, id: "card_zeus_twin", name: "값만 바꾼 호흡", cost: 2, effects: twin.effects.map((effect: { value: number }) => ({ ...effect, value: effect.value * 3 })) },
      // 같은 op라도 사거리가 다르면 판 위에서 다른 일을 한다 — 그것은 새 카드다
      { id: "card_zeus_narrow", name: "좁은 벼락", patron: "zeus", cost: 1, target: "enemy", reach: "3", effects: [{ op: "damage", value: 6 }], tags: ["attack"] },
    ], shipped);
    expect(report.rejected).toEqual([{ id: "card_zeus_twin", failure: "duplicate" }]);
  });

  /** 게이트가 업그레이드에서 보는 것 둘. 값 밴드는 base만 재고 올린 뒤 값은 조합 승률 하한이 본다 */
  it("rejects an upgrade block with the wrong effect count, an out-of-band cost, or a fusion owner", () => {
    // 값 밴드는 base만 잰다 — cost 3에 방어 15면 기대값 4.0으로 tier1 `[4, 8)`의 바닥이다
    const base = { patron: "athena", cost: 3, target: "self", effects: [{ op: "block", value: 15 }], tags: ["defend"] };
    const report = validateItems([
      { ...base, id: "card_up_length", name: "길이가 틀린 강화", upgrade: { effects: [{ value: 1 }, { value: 1 }] } },
      { ...base, id: "card_up_cost", name: "비용이 넘치는 강화", upgrade: { cost: 1 } },
      { id: "card_up_fused", name: "융합에 적은 강화", patron_pair: ["poseidon", "zeus"], cost: 1, target: "enemy", effects: [{ op: "apply_token", token: "soaked", stacks: 1 }, { op: "damage", value: 6 }, { op: "chain", value: 4 }], tags: ["attack", "fused", "multi"], upgrade: { cost: -1 } },
      // 같은 카드에서 `upgrade`만 빼면 통과한다 — 반려의 원인이 그 한 칸이라는 증거다
      { ...base, id: "card_up_ok", name: "온전한 강화", upgrade: { cost: -1 } },
    ]);
    expect(report.rejected).toEqual([
      { id: "card_up_length", failure: "dsl_parse" },
      { id: "card_up_cost", failure: "dsl_parse" },
      { id: "card_up_fused", failure: "dsl_parse" },
    ]);
  });

  it("accepts valid single-patron and fusion cards", () => {
    const report = validateItems([
      { id: "card_valid_guard", name: "온전한 방어", patron: "athena", cost: 1, target: "self", effects: [{ op: "block", value: 5 }], tags: ["defend"] },
      // 융합은 tier3 밴드 `[10, 13]`이다 — 값 9.8이면 patron 밴드 아래로 떨어지지 않고 **어디에도 안 든다**
      { id: "card_valid_fusion", name: "온전한 폭풍", patron_pair: ["poseidon", "zeus"], cost: 1, target: "enemy", effects: [{ op: "apply_token", token: "soaked", stacks: 1 }, { op: "damage", value: 6 }, { op: "chain", value: 4 }], tags: ["attack", "fused", "multi"] },
    ]);
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toHaveLength(2);
  });
});

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
      // 방어 슬롯에는 `target: self` 카드가 30장 있다 — 거기 붙은 출혈은 플레이어가 먹는다
      "token_scope",
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
      groups: { combat: ["group_bad_passive_solo"] },
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

  it("accepts valid single-patron and fusion cards", () => {
    const report = validateItems([
      { id: "card_valid_guard", name: "온전한 방어", patron: "athena", cost: 1, target: "self", effects: [{ op: "block", value: 5 }], tags: ["defend"] },
      { id: "card_valid_fusion", name: "온전한 폭풍", patron_pair: ["poseidon", "zeus"], cost: 1, target: "enemy", effects: [{ op: "apply_token", token: "soaked", stacks: 1 }, { op: "damage", value: 5 }, { op: "chain", value: 4 }], tags: ["attack", "fused", "multi"] },
    ]);
    expect(report.rejected).toEqual([]);
    expect(report.accepted).toHaveLength(2);
  });
});

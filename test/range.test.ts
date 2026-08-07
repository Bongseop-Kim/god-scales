import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  admitPending,
  createCombat,
  endTurn,
  MAX_SLOTS,
  playCard,
  queueEnemy,
  type EnemyDefinition,
} from "../core/combat";
import { applyFavorStageEffects, godEnemyId, type FavorGod } from "../core/favor";
import { executeCard, loadCards, type Card } from "../core/rules";
import type { CombatState, GameState } from "../core/state";
import { canReachTarget, livingInReach, reachOk, reachSlots } from "../core/targeting";
import { validateItems } from "../tools/validate";
import { reachText } from "../ui/card";

const wrap = (combat: CombatState): GameState => ({ seed: 1, combat, favor: {}, grace: {}, graceSlots: {}, map: { depth: 0, lane: 1, grid: [], completed: [] } });
const dummy = (id: string, hp = 30): EnemyDefinition => ({ id, hp, pattern: [{ block: 1 }] });
const strike = (reach?: string, effects: Card["effects"] = [{ op: "damage", value: 6 }]): Card =>
  ({ id: "strike", name: "타격", patron: "ares", cost: 1, target: "enemy", effects, tags: ["attack"], ...(reach ? { reach } : {}) });
/**
 * 칸 0·3에 산 적 하나씩, 가운데 둘은 **시체**다. 편성은 칸 0부터 붙여 채우므로(P-41) 판 가운데의
 * 구멍은 이제 죽음으로만 생긴다 — 「빈 칸으로 들어오는 신」과 「지킴이를 지나가는 카드」가 같은 판을 쓴다
 */
const endsBoard = () => {
  const combat = createCombat(1, [], [dummy("front"), dummy("mid1"), dummy("mid2"), dummy("back")]);
  combat.enemies[1].hp = 0;
  combat.enemies[2].hp = 0;
  return combat;
};

describe("reach", () => {
  it("parses the nine shapes and refuses everything else", () => {
    const shapes = ["0123", "0", "01", "012", "12", "123", "23", "3", "03"];
    expect(shapes.filter(reachOk)).toEqual(shapes);
    expect(shapes.map((shape) => reachSlots(shape).length)).toEqual([4, 1, 2, 3, 2, 3, 2, 1, 2]);
    expect(reachSlots()).toEqual([0, 1, 2, 3]);
    // 내림차순·중복·범위 밖·빈 문자열은 모양이 아니다 — 규칙은 정규식 하나다
    expect(["10", "00", "04", "", "0123 ", "4"].filter(reachOk)).toEqual([]);
  });

  it("names and draws every shape, and falls back on an unknown mask", () => {
    expect(reachText("0123")).toBe("▮▮▮▮ 전체");
    expect(reachText("03")).toBe("▮▯▯▮ 양 끝");
    expect(reachText("12")).toBe("▯▮▮▯ 가운데 둘");
    expect(reachText("013")).toBe("▮▮▯▮ 칸 0·1·3");
  });

  it("uses all nine shapes across the shipped cards", () => {
    const cards = JSON.parse(readFileSync("data/cards.json", "utf8")) as { reach?: string }[];
    const used = new Set(cards.map(({ reach }) => reach ?? "0123"));
    expect([...used].sort()).toEqual(["0", "01", "012", "0123", "03", "12", "123", "23", "3"]);
    // 기본값은 마스크를 안 적은 카드가 쓴다 — 명시하면 같은 뜻의 두 번째 표기가 된다
    expect(cards.filter(({ reach }) => reach === "0123")).toEqual([]);
  });

  it("keeps out-of-reach enemies out of the target list and out of the hand", () => {
    const combat = endsBoard();
    expect(livingInReach(combat).map(({ id }) => id)).toEqual(["front", "back"]);
    expect(livingInReach(combat, "0").map(({ id }) => id)).toEqual(["front"]);
    expect(livingInReach(combat, "3").map(({ id }) => id)).toEqual(["back"]);
    // 가운데 둘은 비어 있다 — 그 카드는 낼 수 없고, 광역은 낼 수 있으나 아무도 안 맞는다
    expect(livingInReach(combat, "12")).toEqual([]);
    expect(canReachTarget(combat, strike("12"))).toBe(false);
    expect(canReachTarget(combat, { target: "all_enemies", reach: "12" })).toBe(true);
    expect(() => executeCard(wrap(combat), strike("3"), "front")).toThrow(/in reach/);
  });

  it("stops chain at the reach edge", () => {
    const combat = createCombat(1, [], [dummy("a"), dummy("b"), dummy("c"), dummy("d")]);
    executeCard(wrap(combat), strike("01", [{ op: "chain", value: 4 }]), "a");
    // 연쇄는 사거리 안의 다른 적만 친다 — 안 걸면 `01` 카드가 넷을 다 때린다
    expect(combat.enemies.map(({ hp }) => hp)).toEqual([30, 26, 30, 30]);
    // 한 칸짜리 사거리에서는 연쇄가 닿을 곳이 없다 — 죽은 효과라 낼 때 던진다
    expect(() => loadCards([strike("0", [{ op: "chain", value: 4 }])])).toThrow(/two reachable slots/);
  });

  it("lets a narrow card walk past the guard the wide card feeds", () => {
    const combat = endsBoard();
    combat.enemies[0].passives = { guard: 2 };
    const state = wrap(combat);
    // 전체 사거리로 뒷칸을 노리면 앞칸 지킴이가 대신 받는다 — 앞을 못 뚫으면 뒤에 못 닿는다
    executeCard(state, strike(), "back");
    expect(combat.enemies.map(({ hp }) => hp)).toEqual([24, 0, 0, 30]);
    // `3`은 지킴이를 지나간다. 이것이 좁은 사거리가 값을 갖는 유일한 이유다
    executeCard(state, strike("3"), "back");
    expect(combat.enemies.map(({ hp }) => hp)).toEqual([24, 0, 0, 24]);
    expect(combat.enemies[0].passives?.guard, "지나간 카드는 스택을 태우지 않는다").toBe(1);
  });
});

describe("slots", () => {
  it("throws on a fifth slot and keeps the board four wide", () => {
    const five = Array.from({ length: MAX_SLOTS + 1 }, (_, index) => dummy(`e${index}`));
    expect(() => createCombat(1, [], five)).toThrow(/board has 4/);
    expect(createCombat(1, [], [dummy("solo")]).enemies).toHaveLength(MAX_SLOTS);
    // 빈 칸은 시체와 같은 꼴이다 — `defeated`가 미리 찍혀 있어 `rally`가 그것을 죽음으로 세지 않는다
    expect(createCombat(1, [], [dummy("solo")]).enemies.slice(1).map(({ hp, defeated }) => [hp, defeated]))
      .toEqual([[0, true], [0, true], [0, true]]);
  });

  /**
   * 자리 규칙은 칸 번호 표가 아니라 **순서 하나**다(P-41) — 앞줄 역할이 뒷줄 역할보다 뒤에 서면 반려.
   * 뿌리가 칸 0이라 「뒷줄 역할은 편성을 소유할 수 없다」가 그 첫 항으로 그대로 따라온다
   */
  it("rejects a lineup that stands a front role behind a back role", () => {
    const back = {
      id: "enemy_under_pressure", name: "뒷줄", region: "underworld", tier: "normal", role: "pressure",
      hp: 40, intent_visible: true, pattern: [{ op: "damage", value: 10 }], pattern_mode: "cycle",
      // 뿌리가 압박(뒷줄)인데 칸 1에 난동(앞줄)이 선다 — 순서가 뒤집혔다
      groups: [{ id: "group_bad_slot", with: ["enemy_under_brute", "enemy_under_swarm", "enemy_under_zealot"] }],
    };
    expect(validateItems([back]).rejected).toEqual([{ id: "enemy_under_pressure", failure: "slot_scope" }]);
    // 같은 넷을 앞줄 셋 · 뒷줄 하나로 세우면 순서가 맞는다 — 세기는 `value_outlier`가 따로 본다
    const ordered = { ...back, role: "brute", groups: [{ id: "group_ok_slot", with: ["enemy_under_swarm", "enemy_under_attrition", "enemy_under_zealot"] }] };
    expect(validateItems([ordered]).rejected.map(({ failure }) => failure)).toEqual(["value_outlier"]);
    // 다섯째 칸을 적은 편성은 여전히 자리에서 걸린다
    const wide = { ...back, role: "brute", groups: [{ id: "group_wide", with: ["a", "b", "c", "enemy_under_zealot"] }] };
    expect(validateItems([wide]).rejected).toEqual([{ id: "enemy_under_pressure", failure: "slot_scope" }]);
  });

  it("keeps the shipped lineups inside their roles", () => {
    const enemies = JSON.parse(readFileSync("data/enemies.json", "utf8"));
    expect(validateItems(enemies).rejected).toEqual([]);
  });
});

describe("shove", () => {
  /**
   * 아무 일도 안 하는 패턴. `dummy`의 방어 1이 섞이면 자리가 아니라 방어를 재게 된다 —
   * `createCombat`은 패턴을 안 읽으므로 판은 `dummy`로 세우고 사전만 갈아 끼운다
   */
  const idle = (...ids: string[]) => new Map(ids.map((id) => [id, { id, hp: 30, pattern: [{}] } as EnemyDefinition]));
  const ids = (combat: CombatState) => combat.enemies.map(({ id }) => id);

  it("sends the displaced enemy one slot back and swaps whoever stands there", () => {
    const combat = createCombat(1, [], [dummy("a"), dummy("b"), dummy("c")]);
    combat.enemies[0].tokens.displace = 1;
    endTurn(wrap(combat), idle("a", "b", "c"));
    expect(ids(combat)).toEqual(["b", "a", "c", "empty_3"]);
    // 밀린 적은 그 턴을 쉰다 — 패턴도 안 넘어간다. 옆의 둘은 넘어간다
    expect(combat.enemies.map(({ patternIndex }) => patternIndex)).toEqual([1, 0, 1, 0]);
    expect(combat.enemies[1].tokens.displace).toBeUndefined();
  });

  it("swaps into the hole instead of moving into it", () => {
    const combat = endsBoard();
    combat.enemies[0].tokens.displace = 1;
    endTurn(wrap(combat), idle("front", "back"));
    // 뒤가 비어 있어도 맞바꿈이다. 칸 0이 비는 것은 이동도 마찬가지다 — 다른 것은 아래 시체다
    expect(ids(combat)).toEqual(["mid1", "front", "mid2", "back"]);
    expect(combat.enemies.filter(({ hp }) => hp <= 0)).toHaveLength(2);
  });

  /** 맞바꿈이 사는 값. 시체를 덮어 쓰면 `queueEnemy`가 중복을 못 잡아 방금 죽인 신이 다시 큐에 든다 */
  it("carries the corpse it swapped past instead of overwriting it", () => {
    const combat = createCombat(1, [], [dummy("a"), dummy("enemy_god_ares")]);
    combat.enemies[1].hp = 0;
    combat.enemies[0].tokens.displace = 1;
    endTurn(wrap(combat), idle("a", "enemy_god_ares"));
    expect(ids(combat)).toEqual(["enemy_god_ares", "a", "empty_2", "empty_3"]);
    queueEnemy(combat, "enemy_god_ares");
    expect(combat.pending).toEqual([]);
  });

  it("burns the token for nothing in the back slot", () => {
    const combat = endsBoard();
    combat.enemies[3].tokens.displace = 1;
    endTurn(wrap(combat), idle("front", "back"));
    expect(ids(combat)).toEqual(["front", "mid1", "mid2", "back"]);
    expect(combat.enemies[3].tokens.displace).toBeUndefined();
    expect(combat.enemies[3].patternIndex, "쉬는 것은 그대로다").toBe(0);
  });

  it("never moves one enemy two slots in a turn", () => {
    const combat = createCombat(1, [], [dummy("a"), dummy("b"), dummy("c"), dummy("d")]);
    combat.enemies[0].tokens.displace = 1;
    combat.enemies[1].tokens.displace = 1;
    endTurn(wrap(combat), idle("a", "b", "c", "d"));
    // 역순(칸 3 → 0)이라 둘이 한 칸씩 간다. 정순이면 `b`가 칸 0으로 올라가 처리되지 않고 밀림도 안 쓴다
    expect(ids(combat)).toEqual(["c", "a", "b", "d"]);
    expect(combat.enemies.every(({ tokens }) => tokens.displace === undefined)).toBe(true);
  });

  it("rests the shoved enemy for the turn it is shoved", () => {
    const combat = createCombat(1, [], [dummy("a")]);
    const state = wrap(combat);
    combat.enemies[0].tokens.displace = 1;
    const hitting = new Map([["a", { id: "a", hp: 30, pattern: [{ damage: 5 }] } as EnemyDefinition]]);
    endTurn(state, hitting);
    expect([combat.player.hp, ids(combat)[1]]).toEqual([100, "a"]);
    // 다음 턴에는 같은 패턴을 그대로 낸다
    endTurn(state, hitting);
    expect(combat.player.hp).toBe(95);
  });

  it("opens the reach the guard was closing", () => {
    const combat = createCombat(1, [], [dummy("a"), dummy("b"), { ...dummy("g"), passives: { guard: 2 } }]);
    const state = wrap(combat);
    // 앞 셋 카드는 사거리 안의 지킴이를 지날 수 없다 — 칸 2가 그 안이다
    executeCard(state, strike("012"), "a");
    expect(combat.enemies.map(({ hp }) => hp)).toEqual([30, 30, 24, 0]);
    combat.enemies[2].tokens.displace = 1;
    endTurn(state, idle("a", "b", "g"));
    // 밀어내기가 지킴이를 칸 3으로 보낸다 — 사거리 밖이므로 같은 카드가 이제 대상에 닿는다
    expect(ids(combat)).toEqual(["a", "b", "empty_3", "g"]);
    executeCard(state, strike("012"), "a");
    expect(combat.enemies.map(({ hp }) => hp)).toEqual([24, 30, 0, 24]);
    expect(combat.enemies[3].passives?.guard, "지나간 카드는 스택을 태우지 않는다").toBe(1);
  });
});

describe("god admission", () => {
  const gods = JSON.parse(readFileSync("data/gods.json", "utf8")) as FavorGod[];
  const zeus = gods.filter(({ id }) => id === "zeus");
  const godDefinition = (id: string): EnemyDefinition => ({ id, hp: 60, pattern: [{ damage: 7 }] });
  const definitions = (...enemies: EnemyDefinition[]) => new Map(enemies.map((enemy) => [enemy.id, enemy]));

  it("queues on wrath instead of stepping in, then takes the frontmost empty slot", () => {
    const combat = endsBoard();
    const state = wrap(combat);
    state.favor = { zeus: 0 };
    applyFavorStageEffects(state, zeus);
    // 진노는 큐에만 넣는다 — 규칙이 한 줄이 되고 카드 실행 중에 배열이 바뀌는 자리가 안 생긴다
    expect(combat.pending).toEqual([godEnemyId("zeus")]);
    admitPending(combat, definitions(godDefinition(godEnemyId("zeus"))));
    expect(combat.pending).toEqual([]);
    // 빈 칸이 여럿이면 가장 앞이다 — 칸 1이 비어 있고 칸 2도 비어 있다
    expect(combat.enemies.map(({ id }) => id)).toEqual(["front", godEnemyId("zeus"), "mid2", "back"]);
    // 이미 판에 서 있는 신은 다시 큐에 안 들어간다
    applyFavorStageEffects(state, zeus);
    expect(combat.pending).toEqual([]);
  });

  it("waits at the door while the board is full and steps into the slot a death opens", () => {
    const full = createCombat(1, [], [dummy("a"), { ...dummy("b"), passives: { rally: 2 } }, dummy("c"), dummy("d")]);
    const state = wrap(full);
    const map = definitions(...["a", "b", "c", "d"].map((id) => dummy(id)), godDefinition("enemy_god_ares"));
    queueEnemy(full, "enemy_god_ares");
    admitPending(full, map);
    expect(full.pending, "4칸이 꽉 차면 큐는 그대로 기다린다").toEqual(["enemy_god_ares"]);

    full.enemies[2].hp = 0;
    endTurn(state, map);
    expect(full.enemies.map(({ id }) => id)).toEqual(["a", "b", "enemy_god_ares", "d"]);
    expect(full.pending).toEqual([]);
    expect(full.outcome, "들어선 신이 조우를 이어받는다").toBe("ongoing");
    // 시체를 밀어내기 **전에** 거둔다 — 자리를 먼저 내주면 그 죽음은 아무도 못 보고 `rally`가 헛돈다
    expect(full.enemies[1].tokens.frenzy, "죽은 칸을 신이 물려받아도 rally는 한 번 돈다").toBe(2);
  });

  it("never admits in the middle of a card", () => {
    const combat = createCombat(1, [], [dummy("a", 6), dummy("b")]);
    const state = wrap(combat);
    queueEnemy(combat, "enemy_god_ares");
    const cards = new Map([["strike", strike()]]);
    combat.hand = ["strike"];
    combat.energy = 3;
    playCard(state, cards, "strike", "a");
    // 마지막 적을 죽인 카드가 판을 바꾸면 진행 중인 연쇄가 방금 들어온 신을 때린다
    expect(combat.enemies.map(({ id }) => id)).toEqual(["a", "b", "empty_2", "empty_3"]);
    expect(combat.pending).toEqual(["enemy_god_ares"]);
  });

  it("does not call it a victory while a god waits at the door", () => {
    const combat = createCombat(1, [], [dummy("a", 6)]);
    const state = wrap(combat);
    queueEnemy(combat, "enemy_god_ares");
    combat.hand = ["strike"];
    combat.energy = 3;
    // 마지막 적을 카드가 죽여도 아직 끝이 아니다 — 여기서 승리를 박으면 진노가 부른 신이 사라진다
    playCard(state, new Map([["strike", strike()]]), "strike", "a");
    expect(combat.outcome).toBe("ongoing");
    // 입장은 여전히 `endTurn`이 한다. 신이 들어서면 조우가 이어진다
    endTurn(state, definitions(godDefinition("enemy_god_ares")));
    expect(combat.enemies.map(({ id }) => id)).toEqual(["enemy_god_ares", "empty_1", "empty_2", "empty_3"]);
    expect(combat.outcome).toBe("ongoing");
  });

  it("wires every wrath to a shipped god enemy", () => {
    const enemies = JSON.parse(readFileSync("data/enemies.json", "utf8")) as { id: string; tier: string }[];
    const joined = gods.map(({ id }) => id);
    expect(joined.filter((god) => enemies.some(({ id, tier }) => tier === "god" && id === godEnemyId(god)))).toEqual(joined);
    for (const god of gods) {
      expect(god.stage_effects.wrath?.on_encounter_start?.some(({ op }) => op === "join"), god.id).toBe(true);
    }
    // 없는 신 적을 가리키는 합류는 조우 중에 던진다 — 게이트가 먼저 잡는다
    const broken = structuredClone(gods[0]) as FavorGod & { id: string };
    broken.stage_effects.wrath!.on_encounter_start = [{ op: "join", god: "hades", target: "self" } as never];
    expect(validateItems([broken as never]).rejected).toEqual([{ id: "zeus", failure: "token_scope" }]);
  });
});

/**
 * 두 칸을 차지하는 적. **같은 `EnemyState` 참조가 칸 0과 1 양쪽에 선다** — 체력·토큰·패턴이 하나라
 * 두 번째 진실이 안 생기고, 대가는 순회 다섯 곳의 중복 제거뿐이다(`core/combat.ts`의 `actors`)
 */
describe("two-slot enemy", () => {
  const boss = (id = "boss", hp = 60): EnemyDefinition => ({ id, hp, pattern: [{ damage: 5 }], size: 2 });
  const ids = (combat: CombatState) => combat.enemies.map(({ id }) => id);

  it("stands the same object in both slots and leaves the rest empty", () => {
    const combat = createCombat(1, [], [boss()]);
    expect(ids(combat)).toEqual(["boss", "boss", "empty_2", "empty_3"]);
    expect(combat.enemies[0], "칸 0과 1은 같은 객체다 — 체력 막대가 하나다").toBe(combat.enemies[1]);
    // 칸 합이 판을 넘으면 지금처럼 던진다 — 두 칸짜리 둘은 넷을 채우고 셋째는 다섯째 칸이다
    expect(() => createCombat(1, [], [boss("a"), boss("b"), boss("c")])).toThrow(/needs 6 slots/);
  });

  it("is reached from either slot and takes the damage once", () => {
    const combat = createCombat(1, [], [boss()]);
    for (const reach of ["0", "1", "01", "12", undefined]) {
      expect(livingInReach(combat, reach).map(({ id }) => id), reach ?? "0123").toEqual(["boss"]);
    }
    // 사거리 `23`은 빈 칸 둘뿐이라 닿지 않는다 — 두 칸짜리라도 판 전체를 덮지는 않는다
    expect(livingInReach(combat, "23")).toEqual([]);
    // 광역이 두 번 때리면 두 칸짜리는 체력이 반값이다. `livingInReach` 한 곳의 중복 제거가 그것을 막는다
    executeCard(wrap(combat), { ...strike(), target: "all_enemies" }, undefined);
    expect(combat.enemies[0].hp).toBe(54);
  });

  it("acts once a turn and bleeds once", () => {
    const combat = createCombat(1, [], [boss()]);
    combat.enemies[0].tokens.bleed = 2;
    endTurn(wrap(combat), new Map([["boss", { id: "boss", hp: 60, pattern: [{ damage: 5 }] } as EnemyDefinition]]));
    // 배열을 그대로 돌면 여기가 90이고 이 계획은 난이도 개편이 된다
    expect(combat.player.hp).toBe(95);
    expect(combat.enemies[0].hp, "출혈도 한 번이다").toBe(58);
  });

  it("burns the displace token without moving", () => {
    const combat = createCombat(1, [], [boss()]);
    combat.enemies[0].tokens.displace = 1;
    endTurn(wrap(combat), new Map([["boss", { id: "boss", hp: 60, pattern: [{ damage: 5 }] } as EnemyDefinition]]));
    // 자리는 그대로고 토큰은 소모된다 — 맨 뒤 불발과 같은 자리다. 밀린 턴은 쉰다
    expect(ids(combat)).toEqual(["boss", "boss", "empty_2", "empty_3"]);
    expect(combat.enemies[0].tokens.displace).toBeUndefined();
    expect(combat.player.hp).toBe(100);
  });

  it("frees both slots when it dies and admits the waiting god at the front", () => {
    const combat = createCombat(1, [], [boss()]);
    const state = wrap(combat);
    queueEnemy(combat, "enemy_god_ares");
    combat.enemies[0].hp = 0;
    endTurn(state, new Map([["enemy_god_ares", { id: "enemy_god_ares", hp: 60, pattern: [{ damage: 5 }] } as EnemyDefinition]]));
    expect(ids(combat)).toEqual(["enemy_god_ares", "boss", "empty_2", "empty_3"]);
    expect(combat.outcome).toBe("ongoing");
  });

  it("ships the region bosses two slots wide", () => {
    const enemies = JSON.parse(readFileSync("data/enemies.json", "utf8")) as { id: string; tier: string }[];
    const bosses = enemies.filter(({ tier }) => tier === "boss").map(({ id }) => id);
    expect(bosses).toHaveLength(2);
  });
});

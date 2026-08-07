import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { takeRest } from "../core/map";
import { cardLevel, MAX_UPGRADE, upgradeId, upgraded, type Card } from "../core/rules";
import type { GameState } from "../core/state";
import { createCombat } from "../core/combat";
import { run, runSteps } from "../sim/engine";

const cards = JSON.parse(readFileSync("data/cards.json", "utf8")) as Card[];
const named = (name: string) => cards.find((card) => card.name === name)!;
const numbers = (card: Card) => card.effects.map(({ value, stacks }) => value ?? stacks ?? 0);

describe("card upgrades", () => {
  /**
   * 규칙이 160장을 계산하고 19장만 손으로 적는다. **`self_damage`가 안 오르는 것이 규칙의 핵심이다** —
   * 아레스의 자해 카드가 업그레이드로 순수하게 좋아진다
   */
  it("scales damage, block, heal, and chain by 1.4 and leaves the rest alone", () => {
    const table: [string, number[], number[]][] = [
      ["작은 번개", [7], [10]],
      ["큰 낙뢰", [16], [23]],
      ["전하 방벽", [7], [10]],
      ["갈래 전광", [5, 5], [7, 7]],
      ["처형", [21, 2], [30, 2]],
      ["피의 일격", [6, 1], [9, 1]],
    ];
    for (const [name, first, second] of table) {
      expect(numbers(upgraded(named(name), 1)), `${name} +1`).toEqual(first);
      expect(numbers(upgraded(named(name), 2)), `${name} +2`).toEqual(second);
    }
    // 레벨 0은 그 카드 자신이다 — base와 업그레이드본이 같은 함수를 지난다
    expect(upgraded(named("작은 번개"), 0)).toBe(named("작은 번개"));
  });

  it("lets the written exception overwrite the rule", () => {
    // 비용은 0에서 멈춘다 — 에너지 카드는 그래서 `+1`이 곧 상한이다
    expect([upgraded(named("축전"), 1), upgraded(named("축전"), 2)].map(({ cost }) => cost)).toEqual([0, 0]);
    expect(numbers(upgraded(named("축전"), 2)), "에너지는 안 오른다").toEqual([2]);
    // 스택은 규칙이 안 건드린다 — 델타를 레벨만큼 더한다
    expect(numbers(upgraded(named("광란"), 1))).toEqual([5]);
    expect(numbers(upgraded(named("광란"), 2))).toEqual([7]);
    expect(numbers(upgraded(named("가시 성벽"), 2))).toEqual([5, 4]);
  });

  /** 19장이 필드로 돌고 나머지는 규칙이다. 융합 열 장은 대상 밖이라 `upgrade`를 적을 수 없다 */
  it("keeps the exception list to nineteen cards and off the fusion ten", () => {
    expect(cards.filter(({ upgrade }) => upgrade)).toHaveLength(19);
    expect(cards.filter((card) => card.upgrade && card.patronPair)).toEqual([]);
  });

  it("carries the level in the id and never changes the deck's length", () => {
    expect(cardLevel("card_zeus_12")).toEqual({ base: "card_zeus_12", level: 0 });
    expect(cardLevel("card_zeus_12+2")).toEqual({ base: "card_zeus_12", level: 2 });
    expect(upgradeId(upgradeId("card_zeus_12"))).toBe("card_zeus_12+2");
    expect(() => upgradeId(`card_zeus_12+${MAX_UPGRADE}`)).toThrow(/max upgrade/);

    // 같은 카드 두 장 중 **한 장만** 오른다 — 병행 맵으로는 표현할 수 없는 것이 이 한 줄이다
    const deck = ["card_zeus_12", "card_zeus_12", "card_athena_01"];
    const state: GameState = {
      seed: 1, combat: createCombat(1, [], []), favor: {}, grace: {}, graceSlots: {},
      map: { depth: 0, lane: 1, grid: [], completed: [] },
    };
    takeRest(state, ["zeus"], deck, "upgrade", "card_zeus_12");
    expect(deck).toEqual(["card_zeus_12+1", "card_zeus_12", "card_athena_01"]);
  });

  /**
   * 휴식처가 3택이 됐다. 봇은 멀쩡하면 강화를 고르므로 `rest_card`가 **강화 가능한 카드만** 싣는다 —
   * 덱 길이는 그대로고 그 자리만 `+N`으로 바뀐다
   */
  it("offers upgrade at the rest node and swaps the deck slot in place", () => {
    // ponytail: 8시드면 단언 둘이 똑같이 깨진다 — 40은 실행시간만 다섯 배였다
    for (let seed = 1; seed <= 8; seed += 1) {
      const steps = runSteps(seed);
      let step = steps.next();
      let sizeBefore = 0;
      while (!step.done) {
        const { phase, options } = step.value;
        if (phase === "rest") {
          expect(options).toContain("upgrade");
          sizeBefore = step.value.observation.deck.length;
        }
        if (phase === "rest_card" && sizeBefore) {
          // 상한에 닿은 카드는 후보에서 빠진다
          expect(options.every((id) => cardLevel(id).level < MAX_UPGRADE)).toBe(true);
        }
        const answer = phase === "path" ? options.find((option) => option.endsWith(":rest")) ?? step.value.bot : step.value.bot;
        step = steps.next(answer);
      }
    }

    // 열 장으로 들어가 열 장으로 나온다 — 강화는 지우는 것이 아니라 갈아 끼우는 것이다
    const steps = runSteps(3);
    let step = steps.next();
    let before: string[] = [];
    let after: string[] | undefined;
    while (!step.done && after === undefined) {
      const { phase, options } = step.value;
      if (phase === "rest") before = step.value.observation.deck.map(({ id }) => id);
      const answer = phase === "path"
        ? options.find((option) => option.endsWith(":rest")) ?? step.value.bot
        : phase === "rest" ? "upgrade" : step.value.bot;
      step = steps.next(answer);
      // 덱을 통째로 싣는 관측은 지도 쪽뿐이다 — 쉼터를 지난 뒤 첫 갈림길에서 읽는다
      if (before.length && !step.done && step.value.phase === "path") after = step.value.observation.deck.map(({ id }) => id);
    }
    expect(before.length, "seed 3 never reaches a rest node").toBeGreaterThan(0);
    expect(after).toHaveLength(before.length);
    expect(after!.filter((id) => cardLevel(id).level > 0)).toHaveLength(1);
  });

  /**
   * 옛 replay가 그대로 재생된다. `+N`은 **id 접미사**라 파일 형식이 한 글자도 안 바뀌었고,
   * 강화를 한 번도 안 고른 로그는 P-44 이전과 같은 결정열이다
   */
  it("replays its own action log with nothing substituted", () => {
    const played = run(12);
    const replayed = run(12, undefined, played.actions);
    expect(replayed.substituted).toBe(0);
    expect(replayed.cardsPlayed).toEqual(played.cardsPlayed);
    // 강화를 한 번도 안 고른 로그에는 `+N`이 한 글자도 없다 — 옛 로그가 그대로 사는 자리다
    expect(played.actions.some(({ choice }) => typeof choice === "string" && choice.includes("+"))).toBe(false);
  });
});

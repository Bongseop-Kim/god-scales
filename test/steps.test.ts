import { describe, expect, it } from "vitest";
import cardData from "../data/cards.json" with { type: "json" };
import godData from "../data/gods.json" with { type: "json" };
import { endTurnAction, gods, run, runSteps, type Decision } from "../sim/engine";
import type { ReplayAction } from "../sim/replay";

/** 갈래는 이제 `"lane:type"`이다. 그 종류가 열려 있으면 고르고, 없으면 봇 답을 쓴다 */
const pickPath = (decision: Decision, type: string) => decision.options.find((option) => option.endsWith(`:${type}`)) ?? decision.bot;

describe("steppable engine", () => {
  it("stops at every decision phase", () => {
    // 시드 5 → 11: 여덟 종류를 전부 지나는 시드다. 갈래가 격자에서 오면서 5가 은총 전에 끝났다
    const steps = runSteps(11);
    const seen = new Set<string>();
    let step = steps.next();
    while (!step.done) {
      seen.add(step.value.phase);
      // 봇은 쉴 때 항상 heal을 골라서 rest_card에 닿지 않는다 — 사람처럼 remove를 눌러본다
      const answer = step.value.phase === "path" ? pickPath(step.value, "rest") : step.value.phase === "rest" ? "remove" : step.value.bot;
      step = steps.next(answer);
    }
    expect(seen).toEqual(new Set(["path", "card", "target", "rest", "rest_card", "reward", "grace", "demand"]));
  });

  /**
   * 타이틀이 조합을 열었으므로 열 칸이 다 사람의 선택지다 — 하나라도 융합 카드가 없으면 `runSteps`가
   * 첫 `next()`에서 던지고 화면이 통째로 빈다. `data/gods.json`을 직접 보는 이유는 UI(브라우저 모듈)를
   * 안 끌어오기 위해서다: 두 배열이 갈리면 화면 순서와 엔진 순서가 어긋난다
   */
  it("starts every one of the ten pairings", () => {
    expect(godData.map(({ id }) => id)).toEqual(gods);
    const pairs = gods.flatMap((left, index) => gods.slice(index + 1).map((right) => [left, right] as const));
    expect(pairs).toHaveLength(10);
    for (const pair of pairs) expect(() => runSteps(1, undefined, pair).next(), pair.join("+")).not.toThrow();
  });

  it("offers three of that god's graces, each on a distinct slot", () => {
    const patrons = new Set(["zeus", "athena"]);
    /**
     * 「덱 N장」이 정말 지금 덱을 세는지 본다. 시작 덱 배치는 여기에 적지 않는다 — 그러면 엔진의
     * 사본이 된다. 지도 관측이 이미 덱을 그대로 실어 오므로 마지막 것을 든다
     */
    let deck: string[] = [];
    // 시드 5 → 1: P-29의 시련 대가가 호의를 깎아 5가 은혜 앞에서 끝났다. 시련이 은혜를 주는 자리도 여기다
    const steps = runSteps(1);
    let step = steps.next();
    while (!step.done && step.value.phase !== "grace") {
      // 보상은 지도 관측 **뒤에** 덱을 늘린다 — 그 사이에 집은 카드를 얹어야 은혜 화면과 같은 덱이다
      if (step.value.phase === "path" || step.value.phase === "rest") deck = step.value.observation.deck.map(({ id }) => id);
      if (step.value.phase === "reward" && step.value.bot) deck.push(step.value.bot);
      step = steps.next(step.value.bot);
    }
    if (step.done || step.value.phase !== "grace") throw new Error("expected a grace decision");

    const { god, tier, offer } = step.value.observation;
    expect(patrons.has(god)).toBe(true);
    expect([2, 4, 6]).toContain(tier);
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map(({ slot }) => slot)).size).toBe(3);
    for (const grace of offer) {
      expect(grace.id.startsWith(`grace_${god}_`), grace.id).toBe(true);
      expect(grace.effects.length).toBeGreaterThan(0);
      // 「덱 N장」은 지금 덱의 그 태그 카드 수다 — 은혜가 몇 장에 붙는지가 결정의 근거다
      expect(grace.cards).toBe(deck.filter((id) => cardData.find((card) => card.id === id)?.tags.includes(grace.slot)).length);
    }
  });

  it("driving it with bot defaults equals run()", () => {
    const steps = runSteps(7);
    let step = steps.next();
    while (!step.done) step = steps.next(step.value.bot);
    // `substituted`는 기록을 재생할 때만 세는 값이다 — 제너레이터를 직접 돌리면 붙지 않는다
    const { substituted, ...replayed } = run(7);
    expect(substituted).toBe(0);
    expect(step.value).toEqual(replayed);
  });

  it("reports the damage of the previous decision once", () => {
    const steps = runSteps(1);
    // 요구는 전투 앞에서 물으므로 첫 결정이 카드가 아니다 — 카드 결정까지 봇 답으로 넘긴다
    let first = steps.next();
    while (!first.done && first.value.phase !== "card") first = steps.next(first.value.bot);
    if (first.done || first.value.phase !== "card") throw new Error("expected a card decision");
    expect(first.value.observation.hits).toEqual([]);

    // 첫 카드가 적을 때린다 → 다음 결정이 그 피해를 싣고 온다
    const attack = first.value.observation.hand.find(({ effects }) => effects.some(({ op }) => op === "damage"));
    if (!attack) throw new Error("expected a damage card in the opening hand");
    const target = steps.next(attack.id);
    if (target.done || target.value.phase !== "target") throw new Error("expected a target decision");
    // 카드를 아직 내지 않았으므로 새 피해가 없다 — seq는 그대로여야 한다
    expect(target.value.observation.hitSeq).toBe(first.value.observation.hitSeq);
    const enemyId = target.value.options[0];
    const after = steps.next(enemyId);
    if (after.done || after.value.phase !== "card") throw new Error("expected a card decision");

    const hit = after.value.observation.hits.find(({ id }) => id === enemyId)!;
    const struck = after.value.observation.enemies.find(({ id }) => id === enemyId)!;
    expect(hit.amount).toBe(Math.round((struck.maxHp - struck.hp) * 10) / 10);
    expect(after.value.observation.hitSeq).toBe(1);
    // 같은 피해가 두 번 튀지 않도록 seq는 새 피해에서만 오른다. 턴을 넘기면 피해 뭉치가 **둘** 생긴다 —
    // 적의 공격(2)과 2턴 시작의 신 개입(3)이다. 개입을 안 세면 화면이 그 피해를 못 튀긴다 (P-34)
    expect(steps.next(endTurnAction).value).toMatchObject({ observation: { hitSeq: 3 } });
  });

  it("adds the reward pick to the deck and honors a scripted skip", () => {
    const taken = run(1);
    const picks = taken.actions.flatMap(({ type, choice }) => (type === "reward" ? [choice] : []));
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((choice) => choice !== "")).toBe(true);
    // 집은 카드는 덱에 들어가 이후 전투에 실제로 나온다
    expect(picks.some((choice) => taken.cardsPlayed.includes(choice))).toBe(true);

    // 건너뛰기는 빈 문자열로 기록된다 — 기록하지 않으면 재생 때 봇이 대신 한 장 집는다
    const skips: ReplayAction[] = Array.from({ length: 12 }, () => ({ type: "reward", choice: "" }));
    const skipped = run(1, undefined, skips);
    expect(skipped.actions.filter(({ type }) => type === "reward").every(({ choice }) => choice === "")).toBe(true);
    expect(skipped.cardsPlayed).not.toEqual(taken.cardsPlayed);
  });

  it("consumes a scripted action only when the phase matches", () => {
    // 첫 결정은 갈래다 — 카드 결정까지 봇 답으로 넘기고 그 자리의 대안을 하나 집는다
    const steps = runSteps(3);
    let first = steps.next();
    const opening: ReplayAction[] = [];
    while (!first.done && first.value.phase !== "card") {
      opening.push({ type: first.value.phase, choice: first.value.bot } as ReplayAction);
      first = steps.next(first.value.bot);
    }
    if (first.done || first.value.phase !== "card") throw new Error("expected a card decision");
    const other = first.value.options.find((id) => id !== first.value.bot && id !== endTurnAction);
    if (!other) throw new Error("expected a second affordable card");
    // 봇이 걸어간 갈래를 그대로 기록으로 쓴다 — 지금 낼 수 있는 값이어야 대체가 0이다
    const paths = opening.filter(({ type }) => type === "path");
    expect(paths).toHaveLength(1);

    const scripted = run(3, undefined, [...paths, { type: "card", choice: other }]);
    expect(scripted.cardsPlayed[0]).toBe(other);
    // 카드 액션이 path 슬롯을 먹지 않는다 — path만 있는 로그가 카드 액션 추가 후에도 그대로 재생되는 이유
    const pathsOnly = run(3, undefined, paths);
    expect(scripted.pathChoices[0]).toBe(paths[0].choice);
    expect(pathsOnly.pathChoices[0]).toBe(paths[0].choice);
    expect([scripted.substituted, pathsOnly.substituted]).toEqual([0, 0]);
  });
});

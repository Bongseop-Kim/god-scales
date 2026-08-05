import { describe, expect, it } from "vitest";
import cardData from "../data/cards.json" with { type: "json" };
import { endTurnAction, godDecks, run, runSteps } from "../sim/engine";
import type { ReplayAction } from "../sim/replay";

describe("steppable engine", () => {
  it("stops at every decision phase", () => {
    // 시드 4는 여덟 종류를 전부 지난다. 요구가 조건 판정을 받게 되면서 호의가 천천히 올라
    // 시드 1은 은총 마일스톤에 닿기 전에 끝난다
    const steps = runSteps(4);
    const seen = new Set<string>();
    let step = steps.next();
    while (!step.done) {
      seen.add(step.value.phase);
      // 봇은 쉴 때 항상 heal을 골라서 rest_card에 닿지 않는다 — 사람처럼 remove를 눌러본다
      const answer = step.value.phase === "path" ? "rest" : step.value.phase === "rest" ? "remove" : step.value.bot;
      step = steps.next(answer);
    }
    expect(seen).toEqual(new Set(["path", "card", "target", "rest", "rest_card", "reward", "grace", "demand"]));
  });

  it("offers only the milestone god's cards that are in the deck", () => {
    const patrons = new Set(["zeus", "athena"]);
    // 덱은 시작 10장에서 출발해 보상으로만 늘어난다 — 은총 후보가 그 안에 있는지 여기서 잰다
    const deck = new Set([...godDecks.zeus, ...godDecks.athena]);
    const steps = runSteps(4);
    let step = steps.next();
    while (!step.done && step.value.phase !== "grace") {
      if (step.value.phase === "reward") deck.add(step.value.bot);
      step = steps.next(step.value.bot);
    }
    if (step.done || step.value.phase !== "grace") throw new Error("expected a grace decision");

    const { god, milestone, cards } = step.value.observation;
    expect(patrons.has(god)).toBe(true);
    expect([2, 6]).toContain(milestone);
    expect(cards.length).toBeGreaterThan(0);
    for (const { id } of cards) {
      expect(deck.has(id), `${id} not in deck`).toBe(true);
      expect(cardData.find((card) => card.id === id)?.patron).toBe(god);
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
    // 같은 피해가 두 번 튀지 않도록 seq는 새 피해에서만 오른다
    expect(steps.next(endTurnAction).value).toMatchObject({ observation: { hitSeq: 2 } });
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
    const first = runSteps(3).next();
    if (first.done || first.value.phase !== "card") throw new Error("expected a card decision");
    const other = first.value.options.find((id) => id !== first.value.bot && id !== endTurnAction);
    if (!other) throw new Error("expected a second affordable card");
    const paths: ReplayAction[] = [{ type: "path", choice: "rest" }, { type: "path", choice: "rest" }];

    const scripted = run(3, undefined, [{ type: "card", choice: other }, ...paths]);
    expect(scripted.cardsPlayed[0]).toBe(other);
    // 카드 액션이 path 슬롯을 먹지 않는다 — path만 있는 로그가 카드 액션 추가 후에도 그대로 재생되는 이유
    expect(scripted.pathChoices.slice(0, 2)).toEqual(["rest", "rest"]);
    expect(run(3, undefined, paths).pathChoices.slice(0, 2)).toEqual(["rest", "rest"]);
  });
});

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { endTurnAction, runSteps, type Decision } from "../sim/engine.ts";
import { run } from "../sim/engine.ts";
import type { RunResult } from "../sim/report.ts";
import type { ReplayAction } from "../sim/replay.ts";
import { App, MapScreen } from "../ui/app.tsx";
import { DemandScreen, GraceScreen, RestScreen } from "../ui/choices.tsx";
import { CombatScreen } from "../ui/combat.tsx";
import { replayPayload } from "../ui/export.ts";
import { RewardScreen } from "../ui/reward.tsx";

/** 브라우저가 하는 일과 같다 — 엔진이 묻는 결정에 사람이 전부 답하고, 전부 로그에 남는다 */
function playByHand(seed: number, pick: (decision: Decision) => string): { result: RunResult; actions: ReplayAction[] } {
  const steps = runSteps(seed);
  const actions: ReplayAction[] = [];
  let step = steps.next();
  while (!step.done) {
    const human = pick(step.value);
    actions.push({ type: step.value.phase, choice: human } as ReplayAction);
    step = steps.next(human);
  }
  return { result: step.value, actions };
}

/**
 * 여기서 보는 것은 화면이 관측값만으로 그려지는지와 반출물이 재생되는지다.
 * App의 이벤트 배선·화면 전환·반출 버튼을 진짜 클릭으로 지나는 것은 `npm run e2e`(tools/e2e.ts)가 한다 —
 * dev 서버와 Aside 브라우저가 필요해 vitest에 들어가지 않는다
 */
describe("browser replay export", () => {
  it("renders every decision screen from its observation alone", () => {
    // 머리글이 조합·위치·체력을 관측에서 읽는지 본다 — 상수로 박혀 있으면 다른 조합에서 거짓말을 한다
    const screens: Record<string, (decision: never) => ReactElement> = {
      path: (decision) => createElement(MapScreen, { seed: 4, decision, actions: [], onChoosePath: () => {} }),
      card: (decision) => createElement(CombatScreen, { seed: 4, decision, onAnswer: () => {} }),
      target: (decision) => createElement(CombatScreen, { seed: 4, decision, onAnswer: () => {} }),
      rest: (decision) => createElement(RestScreen, { seed: 4, decision, onAnswer: () => {} }),
      rest_card: (decision) => createElement(RestScreen, { seed: 4, decision, onAnswer: () => {} }),
      reward: (decision) => createElement(RewardScreen, { seed: 4, decision, onAnswer: () => {} }),
      grace: (decision) => createElement(GraceScreen, { seed: 4, decision, onAnswer: () => {} }),
      demand: (decision) => createElement(DemandScreen, { seed: 4, decision, onAnswer: () => {} }),
    };
    const seen = new Set<string>();
    // 배포 조합이 아닌 아레스+아르테미스로 돈다 — 머리글이 상수라면 여기서 "제우스 + 아테나"가 나온다.
    // 시드 4 → 5: 여덟 화면을 다 지나는 시드다 (P-31의 파워로 시드 4가 갈림길 전에 끝났다)
    const steps = runSteps(5, undefined, ["ares", "artemis"]);
    let step = steps.next();
    while (!step.done) {
      const { phase, bot } = step.value;
      if (!seen.has(phase)) {
        const markup = renderToStaticMarkup(screens[phase](step.value as never));
        expect(markup, phase).toContain("아레스 + 아르테미스");
        expect(markup, phase).toContain(`체력 ${step.value.observation.hp}/${step.value.observation.maxHp}`);
        seen.add(phase);
      }
      step = steps.next(phase === "path" ? "rest" : phase === "rest" ? "remove" : bot);
    }
    expect(seen).toEqual(new Set(Object.keys(screens)));
  });

  it("renders the setup screen through React", () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("신들의 저울");
    expect(markup).toContain("런 시작");
    expect(markup).toContain("aria-label=\"상태 토큰\"");
  });

  it("replays the same outcome, progress, and final favor", () => {
    const actions: ReplayAction[] = ["combat", "rest", "combat", "rest"].map((choice) => ({ type: "path", choice } as ReplayAction));
    const browser = run(42, undefined, actions);
    const replay = replayPayload(42, actions);
    const cli = run(replay.seed, undefined, replay.actions);

    expect({ won: cli.won, floors: cli.hpCurve.length - 1, favor: cli.favorCurve.at(-1) }).toEqual({
      won: browser.won,
      floors: browser.hpCurve.length - 1,
      favor: browser.favorCurve.at(-1),
    });
    expect(replay.replay_mode).toBe("action_log");
  });

  it("replays a hand-played run, card actions included", () => {
    // 갈림길은 쉼터로, 휴식은 제거로, 요구는 수락으로 고정하고 첫 카드 한 장만 봇과 다르게 낸다.
    // 전투를 내내 봇 반대로 고르면 은총 마일스톤에 닿기 전에 죽는다 — 요구가 조건 판정을 받게 된 뒤로는
    // 호의가 천천히 올라서 300개 시드 안에 그런 런이 없다.
    // 시드 4 → 14 → 5: P-22의 아테나 풀 교체, 다음은 P-25의 적 패시브로 그 앞 시드가 은총 전에 끝났다
    let diverged = false;
    const { result: browser, actions } = playByHand(5, ({ phase, options, bot }) => {
      if (phase === "path") return "rest";
      if (phase === "rest") return "remove";
      if (phase === "demand") return "accept";
      if (phase !== "card" || diverged) return bot;
      const other = options.find((option) => option !== bot && option !== endTurnAction);
      diverged = Boolean(other);
      return other ?? bot;
    });
    const replay = replayPayload(5, actions);
    const cli = run(replay.seed, undefined, replay.actions);

    // 반출에 사람이 고른 여덟 종류가 전부 있어야 한다 — 빠지면 재생 때 봇이 대신 채운다
    for (const type of ["path", "card", "target", "rest", "rest_card", "reward", "grace", "demand"]) {
      expect(actions.some((action) => action.type === type), type).toBe(true);
    }
    expect({ won: cli.won, floors: cli.hpCurve.length - 1, favor: cli.favorCurve.at(-1), cards: cli.cardsPlayed }).toEqual({
      won: browser.won,
      floors: browser.hpCurve.length - 1,
      favor: browser.favorCurve.at(-1),
      cards: browser.cardsPlayed,
    });
    expect(cli.cardsPlayed).not.toEqual(run(5).cardsPlayed);
  });
});

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardDataJson from "../data/cards.json" with { type: "json" };
import { endTurnAction, runSteps, type Decision } from "../sim/engine.ts";
import { run } from "../sim/engine.ts";
import type { RunResult } from "../sim/report.ts";
import type { ReplayAction } from "../sim/replay.ts";
import { App, MapScreen } from "../ui/app.tsx";
import { cardArtCandidates, type CardArtSource } from "../ui/art-keys.ts";
import { DemandScreen, GraceScreen, RestScreen } from "../ui/choices.tsx";
import { CombatScreen } from "../ui/combat.tsx";
import { replayPayload } from "../ui/export.ts";
import { RewardScreen } from "../ui/reward.tsx";

/** 갈래는 `"lane:type"`이다. 그 종류가 열려 있으면 고르고 없으면 봇 답을 쓴다 */
const pickPath = (decision: Decision, type: string) => decision.options.find((option) => option.endsWith(`:${type}`)) ?? decision.bot;

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
      path: (decision) => createElement(MapScreen, { seed: 4, decision, onChoosePath: () => {} }),
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
      step = steps.next(phase === "path" ? pickPath(step.value, "rest") : phase === "rest" ? "remove" : bot);
    }
    expect(seen).toEqual(new Set(Object.keys(screens)));
  });

  /**
   * HUD가 그리는 넷을 한 번에 잡는다 — 진영색(채움/외곽), 지속, 파워 스택, 우호도 단계.
   * 관측을 손으로 짜는 이유는 토큰 셋·파워 둘·진노가 같이 선 턴이 실제 런에서는 드물어서다
   */
  it("draws token faction, duration, powers, and favor stages on the combat screen", () => {
    const decision = {
      phase: "card",
      options: ["card_zeus_bolt"],
      bot: "card_zeus_bolt",
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [],
        // 제우스는 진노(0), 아테나는 헌신(70) — 경계는 core/favor.ts의 favorBoundaries가 정한다
        favor: { zeus: 4, athena: 72 }, grace: { athena: 3 },
        turn: 5, block: 6, energy: 3, draw: 4,
        tokens: { crit: 1, bleed: 2, thorns: 3 },
        hand: [],
        powers: [
          { trigger: "turn_start", card: { id: "p", name: "광란의 문", cost: 1, target: "self", effects: [{ op: "apply_token", token: "frenzy", stacks: 1 }] } },
          { trigger: "turn_start", card: { id: "p", name: "광란의 문", cost: 1, target: "self", effects: [{ op: "apply_token", token: "frenzy", stacks: 1 }] } },
        ],
        enemies: [{
          id: "enemy_under_guardian", hp: 20, maxHp: 30, block: 4,
          tokens: { shock: 2 }, passives: { guard: 2 },
          intent: { damage: 9, token: "soaked", stacks: 1 },
        }],
        hits: [], hitSeq: 0,
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    // 진영은 색과 채움 둘로 간다 — 이로운 치명은 외곽, 해로운 출혈은 채움이다
    expect(markup).toContain("token-badge boon consume");
    expect(markup).toContain("token-badge harmful consume");
    // 지속 셋: 가시는 전투 내내, 감전은 이번 턴
    expect(markup).toContain("token-badge boon combat");
    expect(markup).toContain("token-badge harmful turn");
    // 툴팁은 한글 이름 + 효과 한 줄이다 — 영문 id가 화면에 남아 있으면 안 된다
    expect(markup).toContain("가시 — 맞을 때마다 스택만큼 반격 · 전투 내내");
    expect(markup).not.toContain("soaked");
    // 복합 의도가 「대기」로 뭉개지지 않고 토큰도 한글이다
    expect(markup).toContain("공격 9 + 침수 1");
    // 파워는 스택을 센다 — 두 장 낸 것이 화면에 서야 한다
    expect(markup).toContain("광란의 문");
    expect(markup).toContain("×2");
    // 우호도 둘 상시 + 진노 경고 + 그 단계의 개입, 경계는 favorBoundaries에서
    expect(markup).toContain("favor wrath");
    expect(markup).toContain("favor devotion");
    expect(markup).toContain("진노 · 조우 시작에 나에게 감전 2");
    expect(markup).toContain("헌신 70 / 평온 30 / 분노 10");
    expect(markup).toContain("은총 3");
  });

  it("renders the setup screen through React", () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("신들의 저울");
    expect(markup).toContain("런 시작");
    expect(markup).toContain("aria-label=\"상태 토큰\"");
  });

  it("replays the same outcome, progress, and final favor", () => {
    // 봇이 실제로 걸은 갈래를 기록으로 되먹인다 — 갈래 문자열이 이제 격자에 달려 있어 상수로 못 적는다
    const actions: ReplayAction[] = run(42).actions.filter(({ type }) => type === "path");
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
    // 시드 4 → 14 → 5 → 11: 갈래가 격자에서 오면서 5가 은총 전에 끝났다. 단언은 그대로다
    let diverged = false;
    const { result: browser, actions } = playByHand(11, (decision) => {
      const { phase, options, bot } = decision;
      if (phase === "path") return pickPath(decision, "rest");
      if (phase === "rest") return "remove";
      if (phase === "demand") return "tier1";
      if (phase !== "card" || diverged) return bot;
      const other = options.find((option) => option !== bot && option !== endTurnAction);
      diverged = Boolean(other);
      return other ?? bot;
    });
    const replay = replayPayload(11, actions);
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
    expect(cli.cardsPlayed).not.toEqual(run(11).cardsPlayed);
  });
});

/**
 * 129개 id를 그림 30장이 덮는 규칙(`ui/art-keys.ts`)만 본다 — 파일이 실제로 있는지는
 * `npm run art -- --check`가 전수로 대조한다. **함정 둘이 이 한 줄에 다 걸린다**: 후보에서 `id`를
 * 빼면 융합 10장이, `tags[0]`에서 멈추면 첫 태그가 `power`인 다섯 장이 여기서 안 떨어진다
 */
describe("카드 그림 폴백", () => {
  it("129개 id가 전부 그림 한 장으로 떨어진다", () => {
    const have = new Set(Object.keys(import.meta.glob("../art/cards/*.webp")).map((path) => path.replace(/^.*\/|\.webp$/g, "")));
    expect((cardDataJson as CardArtSource[]).filter((card) => !cardArtCandidates(card).some((key) => have.has(key)))).toEqual([]);
  });
});

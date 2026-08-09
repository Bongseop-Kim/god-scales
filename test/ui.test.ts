import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import iconSheet from "../art/icons.svg?raw";
import cardDataJson from "../data/cards.json" with { type: "json" };
import graceDataJson from "../data/graces.json" with { type: "json" };
import { allCards, endTurnAction, runSteps, type CombatObservation, type Decision } from "../sim/engine.ts";
import { run } from "../sim/engine.ts";
import type { RunResult } from "../sim/report.ts";
import type { ReplayAction } from "../sim/replay.ts";
import { bossLane, generateMap } from "../core/map.ts";
import { upgraded, type Card } from "../core/rules.ts";
import { App, patronPair, RunOpening } from "../ui/app.tsx";
import { cardArtCandidates, cardGod, cardTag, particleStrip, type CardArtSource } from "../ui/shared/art-keys.ts";
import { CardSigns, cardParticleOf, conditionLabel } from "../ui/shared/card.tsx";
import { DemandScreen, GraceScreen, RestScreen } from "../ui/screens/choices.tsx";
import { CombatScreen } from "../ui/screens/combat.tsx";
import { replayPayload } from "../ui/shared/export.ts";
import { StatusBar } from "../ui/shared/header.tsx";
import { CardCatalog, HelpPanel } from "../ui/shared/overlay.tsx";
import { musicForScreen, playSound, sound } from "../ui/shared/sfx.ts";
import { MapPanel, MapScreen } from "../ui/screens/map.tsx";
import { RewardScreen } from "../ui/screens/reward.tsx";
import { TokenDictionary } from "../ui/shared/tokens.tsx";

/**
 * 시트에 없는 id를 `<use>`가 가리키면 **아무 일도 안 일어난다** — 경고도, 빈 그림도 없이 자리만 빈다.
 * 그래서 화면이 실제로 부른 이름을 시트와 맞춘다. `tools/art.ts`는 반대쪽(시트에 28개가 다 들었나)을 센다
 */
const sheetIds = new Set([...iconSheet.matchAll(/id="icon-([\w-]+)"/g)].map(([, id]) => id));
/** 카드 원문. 강화 표기를 보는 두 테스트가 화면과 **같은 파일**에서 값을 읽는다 */
const cards = cardDataJson as unknown as Card[];
const unresolvedIcons = (markup: string) =>
  [...markup.matchAll(/href="#icon-([\w-]+)"/g)].map(([, id]) => id).filter((id) => !sheetIds.has(id));

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
  it("gives every card branch and god a distinct particle strip", () => {
    expect(new Set(Object.values(particleStrip).flatMap(Object.values)).size).toBe(20);
    for (const card of cards as (Card & CardArtSource)[]) {
      const tag = cardTag(card);
      const god = cardGod(card);
      if (tag && god) expect(cardParticleOf(card.id)).toBe(particleStrip[tag][god]);
    }
  });

  it("explains every shipped symbol in the token dictionary", () => {
    const markup = renderToStaticMarkup(createElement(TokenDictionary, undefined, createElement(CardSigns)));
    expect(unresolvedIcons(markup)).toEqual([]);
    for (const name of ["보호", "경화", "결계", "웅크림", "분노", "규합", "고조", "앙심"]) {
      expect(markup).toContain(`<b>${name}</b>`);
    }
    expect(markup).toContain("스택마다 사거리 안 아군의 단일 대상 피해를 대신 받음");
    expect(markup).toContain("공격이 아닌 카드를 내면 광란 +스택");
    expect(markup).toContain("<b>훼방</b>");
    expect(markup).toContain("<b>파워</b>");
    expect(markup).toContain("<b>사냥의 호흡</b>");
    expect(markup).toContain("턴 시작");
    expect(markup).toContain("피해 2 · 치명 1");
    expect(markup).toContain("<b>의도 감춤</b>");
    expect(markup).toContain("<b>헌신</b>");
    expect(markup).toContain("<b>은총</b>");
    expect(markup).toContain("내면 이 전투에서 사라짐");
  });

  it("renders every decision screen from its observation alone", () => {
    // 상태 바(P-54)가 조합·위치·체력을 관측에서 읽는지 본다 — 상수로 박혀 있으면 다른 조합에서 거짓말을 한다
    const screens: Record<string, (decision: never) => ReactElement> = {
      path: (decision) => createElement(MapScreen, { decision, onChoosePath: () => {} }),
      card: (decision) => createElement(CombatScreen, { seed: 4, decision, onAnswer: () => {} }),
      target: (decision) => createElement(CombatScreen, { seed: 4, decision, onAnswer: () => {} }),
      rest: (decision) => createElement(RestScreen, { decision, onAnswer: () => {} }),
      rest_card: (decision) => createElement(RestScreen, { decision, onAnswer: () => {} }),
      reward: (decision) => createElement(RewardScreen, { decision, onAnswer: () => {} }),
      grace: (decision) => createElement(GraceScreen, { decision, onAnswer: () => {} }),
      grace_card: (decision) => createElement(GraceScreen, { decision, onAnswer: () => {} }),
      demand: (decision) => createElement(DemandScreen, { decision, onAnswer: () => {} }),
    };
    const seen = new Set<string>();
    // 배포 조합이 아닌 아레스+아르테미스로 돈다 — 상태 바가 상수라면 여기서 "제우스"가 나온다.
    // 자동 개입 계약에서 여덟 화면을 다 지나는 시드다
    const steps = runSteps(45, undefined, ["ares", "artemis"]);
    let step = steps.next();
    while (!step.done) {
      const { phase, bot } = step.value;
      if (!seen.has(phase)) {
        const markup = renderToStaticMarkup(screens[phase](step.value as never));
        expect(unresolvedIcons(markup), phase).toEqual([]);
        // 화면에 h1 제목·「시드」가 없다(P-54) — 값은 전부 상태 바가 든다
        expect(markup, phase).not.toContain("<h1");
        expect(markup, phase).not.toContain("시드");
        const bar = renderToStaticMarkup(createElement(StatusBar, { view: step.value.observation, onOverlay: () => {} } as never));
        expect(bar, phase).toContain("아레스");
        expect(bar, phase).toContain("아르테미스");
        expect(bar, phase).toContain(`<b>${step.value.observation.hp} / ${step.value.observation.maxHp}</b>`);
        expect(bar, phase).toContain(`덱 ${step.value.observation.deck.length}`);
        seen.add(phase);
      }
      step = steps.next(phase === "path" ? pickPath(step.value, "rest") : phase === "rest" ? "remove" : bot);
    }
    expect(seen).toEqual(new Set(Object.keys(screens)));
  });

  /**
   * HUD가 그리는 넷을 한 번에 잡는다 — 진영색(채움/외곽), 지속, 파워 스택, 우호도 단계.
   * 관측을 손으로 짜는 이유는 토큰 셋·파워 둘·진노가 같이 선 턴이 실제 런에서는 드물어서다.
   * 우호도 미터는 상태 바(P-54)로 갔으므로 같은 관측을 `StatusBar`에도 넣어 같이 잰다
   */
  it("draws token faction, duration, powers, and favor stages on the combat screen", () => {
    const decision = {
      phase: "card",
      options: ["card_zeus_bolt"],
      bot: "card_zeus_bolt",
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], deck: [],
        // 제우스는 진노(0), 아테나는 헌신(70) — 경계는 core/favor.ts의 favorBoundaries가 정한다
        favor: { zeus: 4, athena: 72 }, grace: { athena: 3 },
        turn: 5, block: 6, energy: 3, draw: 4,
        tokens: { crit: 1, bleed: 2, thorns: 3 },
        hand: [],
        powers: [
          { trigger: "turn_start", card: { id: "p", name: "광란의 문", cost: 1, target: "self", effects: [{ op: "apply_token", token: "frenzy", stacks: 1 }] } },
          { trigger: "turn_start", card: { id: "p", name: "광란의 문", cost: 1, target: "self", effects: [{ op: "apply_token", token: "frenzy", stacks: 1 }] } },
        ],
        // 칸 1에 세운다 — 나머지 셋이 빈 칸으로 서는지도 같이 본다
        enemies: [{
          id: "enemy_under_guardian", slot: 1, span: 1, hp: 20, maxHp: 30, block: 4,
          tokens: { shock: 2 }, passives: { guard: 2 },
          intent: { damage: 9, token: "soaked", stacks: 1 },
        }],
        hits: [], hitSeq: 0, guarded: [], promises: [],
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    // 진영은 색과 채움 둘로 간다 — 이로운 치명은 외곽, 해로운 출혈은 채움이다
    expect(markup).toContain("token-badge boon consume");
    expect(markup).toContain("token-badge harmful consume");
    expect(markup).not.toContain("data-stacks");
    // 지속 셋: 가시는 전투 내내, 감전은 이번 턴
    expect(markup).toContain("token-badge boon combat");
    expect(markup).toContain("token-badge harmful turn");
    // 툴팁은 한글 이름 + 효과 한 줄이다 — 영문 id가 화면에 남아 있으면 안 된다
    expect(markup).toContain("가시 — 맞을 때마다 스택만큼 반격 · 전투 내내");
    // 영문 id가 **글자로** 남아 있으면 안 된다 — `href="#icon-soaked"`는 그림을 가리키는 이름이고 안 읽힌다
    expect(markup).not.toMatch(/>[^<]*soaked/);
    // 복합 의도가 「대기」로 뭉개지지 않고 토큰도 한글이다
    expect(markup).toContain("공격 9 + 침수 1");
    // 파워는 스택을 센다 — 두 장 낸 것이 화면에 서야 한다
    expect(markup).toContain("광란의 문");
    expect(markup).toContain("×2");
    expect(markup).toContain('aria-label="파워 턴 시작 광란의 문 광란 1 2개"');
    // 네 칸이 다 선다 — 적은 칸 1에 서고 나머지 셋은 빈 칸으로 자리를 지킨다
    expect(markup).toContain("칸 0 앞");
    expect(markup).toContain("칸 3 뒤");
    expect(markup).toContain("aria-label=\"칸 1 스파르토이 방패병");

    // 우호도 둘 상시 + 진노 경고 + 그 단계의 개입 — 상태 바(P-54)가 든다. 전투 화면에는 중복이 없다
    expect(markup).not.toContain("favor wrath");
    const bar = renderToStaticMarkup(createElement(StatusBar, { view: (decision as { observation: unknown }).observation, onOverlay: () => {} } as never));
    expect(bar).toContain("favor wrath");
    expect(bar).toContain("favor devotion");
    // 단계 펄스는 **경계를 넘는 순간에만** 돈다 — 첫 렌더에 붙으면 미터 둘이 번쩍인다
    expect(bar).not.toContain("crossed");
    // 진노는 이제 신을 적으로 부른다 — `join`이 「나에게 join 0」으로 읽히면 화면이 거짓말을 한다
    expect(bar).toContain("진노 · 나에게 감전 2 · 제우스가 적으로 합류 · 나에게 감전 2");
    expect(bar).toContain("헌신 70 / 평온 30 / 분노 10");
    expect(bar).toContain("은총 3");

    const finale = (decision as unknown as { observation: CombatObservation }).observation;
    const lost = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, outro: { kind: "lost", finale: { ...finale, hp: 0 } }, onAnswer: () => {} }));
    const won = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, outro: { kind: "won", finale: { ...finale, enemies: [] } }, onAnswer: () => {} }));
    expect(lost).toContain('class="player-actor" data-pose="death"');
    expect(won).toContain('data-outro="won"');
  });

  /** 과업과 자동 개입의 두 줄은 전투 관측만으로 그린다 */
  it("draws the promise and its progress", () => {
    const decision = {
      phase: "card",
      options: [],
      bot: endTurnAction,
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], deck: [], favor: { zeus: 50, athena: 50 }, grace: {},
        turn: 5, block: 0, energy: 3, draw: 4, tokens: {}, hand: [], powers: [], enemies: [],
        hits: [], hitSeq: 0, guarded: [],
        quest: { god: "athena", text: "여덟이다.", rule: "이 조우에서 잃은 체력 8 이하", current: 5, target: 8 },
        promises: [{ god: "athena", text: "여덟이다.", rule: "이 조우에서 잃은 체력 8 이하", current: 5, target: 8 }],
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    // 조건은 사람 말이고 현재값/목표가 같은 줄에 선다 — DSL이 화면에 남아 있으면 안 된다
    expect(markup).toContain("이 조우에서 잃은 체력 8 이하");
    expect(markup).not.toContain("damage_taken");
    expect(markup).toContain("5 / 8");
    // 단일 과업만 선다 — quest와 promises가 같은 과업을 들고 있어도 한 번만 그린다
    expect(markup.match(/class="promise"/g)).toHaveLength(1);
    expect(markup).toContain("과업 · 아테나");
    expect(markup).toContain("개입 · 3턴 뒤");
    // 신의 문장은 사라지지 않는다 — 규칙 줄이 그것을 **대신하지 않는다**
    expect(markup).toContain("여덟이다.");
    const bar = renderToStaticMarkup(createElement(StatusBar, { view: (decision as { observation: unknown }).observation, onOverlay: () => {}, onRestart: () => {} } as never));
    expect(bar).toContain("진행 중인 과업 · 아테나 · 이 조우에서 잃은 체력 8 이하");
  });

  it("shows three chosen-god cards with the completed task result", () => {
    const offer = cards.filter(({ patron }) => patron === "athena").slice(0, 3);
    const decision = {
      phase: "reward",
      options: offer.map(({ id }) => id),
      bot: offer[0].id,
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], deck: [], favor: { zeus: 50, athena: 62 }, grace: {}, cards: offer,
        questReward: true,
        questResult: { god: "athena", text: "여덟이다.", rule: "이 조우에서 잃은 체력 8 이하", current: 5, target: 8, settled: "kept" },
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(RewardScreen, { decision, onAnswer: () => {} }));
    expect(markup).toContain("과업 달성 · 아테나");
    expect(markup).toContain("5 / 8");
    expect(markup.match(/class="game-card/g)).toHaveLength(3);
    expect(markup).not.toContain("건너뛰기");
  });

  it("explains only tasks and automatic interventions", () => {
    const markup = renderToStaticMarkup(createElement(HelpPanel));
    expect(markup.match(/<dt>/g)).toHaveLength(2);
    expect(markup).toContain("<dt>과업</dt>");
    expect(markup).toContain("<dt>개입</dt>");
  });

  /**
   * 두 칸을 차지한 보스. 화면이 보는 것은 셋이다 — **한 판만** 뜨는가(엔진이 별칭을 한 번만 내보낸다),
   * 그 판이 두 칸 높이인가, 덮은 칸 1에 빈 칸 자리표시가 안 서는가(서면 판이 다섯 칸이 된다)
   */
  it("draws a two-slot boss as one panel spanning both slots", () => {
    const decision = {
      phase: "card",
      options: [],
      bot: endTurnAction,
      observation: {
        depth: 5, lane: 1, region: "underworld", floor: 6, hp: 60, maxHp: 100,
        patrons: ["zeus", "athena"], grid: [], favor: { zeus: 50, athena: 50 }, grace: {},
        turn: 2, block: 0, energy: 3, draw: 4, tokens: {}, hand: [], powers: [],
        enemies: [{ id: "enemy_under_boss", slot: 0, span: 2, hp: 100, maxHp: 130, block: 0, tokens: {}, passives: { ward: 2 }, intent: { damage: 6 } }],
        hits: [], hitSeq: 0, guarded: [], promises: [],
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    expect([...markup.matchAll(/>케르베로스</g)], "같은 보스가 두 판에 겹쳐 뜨면 안 된다").toHaveLength(1);
    // 두 칸을 차지한 적은 중심이 반 칸 옮는다(P-55) — `--span`이 그 사실을 든다
    expect(markup).toContain("--slot:0;--span:2");
    expect(markup).toContain('aria-label="칸 0~1 앞 케르베로스');
    // 칸 1은 보스가 덮었다. 남는 자리표시는 칸 2·3 둘뿐이다
    expect([...markup.matchAll(/class="enemy empty"/g)]).toHaveLength(2);
    expect(markup).not.toContain("칸 1<");
  });

  /**
   * 카드 면 채널 넷(비용 젬 · 예외 배지 · 아이콘 효과 줄 · 이름 캡션)과 무대. 손으로 짠 관측을 쓰는
   * 이유는 「파워·전체·자해·사거리·조건이 한 손에 다 있는」 턴이 실제 런에 거의 없어서다.
   * 값은 손으로 적었지만 **id·이름·비용·효과는 `data/cards.json`에 있는 그대로**다
   */
  it("draws the cost gem, icon effects, and the card waiting on the stage", () => {
    const hand = [
      { id: "card_zeus_19", name: "감전 연쇄", cost: 2, target: "enemy", reach: "03", effects: [{ op: "damage", value: 6 }, { op: "apply_token", token: "shock", stacks: 2 }, { op: "chain", value: 4 }] },
      { id: "card_ares_14", name: "피의 갈증", cost: 2, target: "enemy", effects: [{ op: "damage", value: 6 }, { op: "heal", value: 6 }, { op: "self_damage", value: 1 }] },
      { id: "card_zeus_23", name: "천 개의 벼락", cost: 1, target: "enemy", effects: [{ op: "apply_token", token: "shock", stacks: 1 }, { op: "chain", value: 1 }] },
      { id: "card_artemis_retry_04", name: "달의 화살비", cost: 3, target: "all_enemies", effects: [{ op: "damage", value: 5 }, { op: "apply_token", token: "mark", stacks: 1 }, { op: "draw", value: 1 }] },
    ];
    const decision = {
      phase: "target",
      options: ["enemy_under_guardian"],
      bot: "enemy_under_guardian",
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], favor: { zeus: 40, athena: 40 }, grace: {},
        turn: 5, block: 0, energy: 3, draw: 4, tokens: {}, hand, powers: [],
        enemies: [{ id: "enemy_under_guardian", slot: 0, span: 1, hp: 20, maxHp: 30, block: 0, tokens: {}, passives: {}, intent: { damage: 9 } }],
        hits: [], hitSeq: 0, guarded: [], promises: [],
        // 무대에 오른 카드. **`view.card`는 id다** — 그것을 그대로 문장에 넣으면 화면에 영문 id가 뜬다
        card: "card_zeus_19",
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    // 비용은 젬 하나가 든다 — 효과문 앞의 「2 에너지 ·」가 사라진 자리다
    expect(markup).toContain('<b class="cost-gem">2</b>');
    expect(markup).toContain('<b class="cost-gem">3</b>');
    // 효과는 적 머리 위 배지와 **같은 글리프**를 쓰고, 시트에 없는 op는 짧은 한글이다
    expect(markup).toContain('href="#icon-damage"');
    expect(markup).toContain('href="#icon-shock"');
    expect(markup).toContain('href="#icon-heal"');
    expect(markup).toContain("뽑기");
    expect(unresolvedIcons(markup)).toEqual([]);
    // 영문 id가 글자로 남으면 안 된다 — 아이콘은 `href`가 가리키는 이름이라 읽히지 않는다
    expect(markup).not.toMatch(/>[^<]*(shock|mark)/);
    // 예외만 배지가 된다: 파워와 전체. 나머지 129장은 배지 자리가 빈다
    expect(markup).toContain('<em class="card-kind">파워</em>');
    expect(markup).toContain('<em class="card-kind">전체</em>');
    // 자해는 경고색, 사거리는 마스크를 적은 카드에만
    expect(markup).toContain('class="harm"');
    expect(markup).toContain("▮▯▯▮");
    // 화면이 채널 넷으로 갈렸으므로 문장은 `aria-label`이 든다 — 숫자만 남으면 「6 2 4」로 읽힌다
    expect(markup).toContain('aria-label="감전 연쇄 · 2 에너지 · ▮▯▯▮ 양 끝 · 피해 6 · 감전 2 · 연쇄 4"');
    // e2e 드라이버가 읽는 값. 화면 문구를 긁던 정규식을 대신한다 — 피의 갈증은 피해 6에 회복·자해다
    expect(markup).toContain('data-cost="2" data-damage="6"');
    // 무대에 선 카드는 **손패에서 빠진다** — 넷 중 한 장이 무대라 부채꼴은 셋이다
    expect(markup).toContain('class="stage"');
    expect(markup).toContain("--n:3");
    expect([...markup.matchAll(/class="game-card"/g)]).toHaveLength(4);
    // 아무것도 안 붙은 토큰 줄은 이름 없는 `role="img"`가 된다 — 스크린 리더에서 정체 불명의 그림 한 장이다
    expect(markup).toContain('aria-label="" aria-hidden="true"');
    // 대상 선택 중에는 손 전체가 물러난다. 힌트에 id가 들어가면 「card_zeus_19 · 대상을」이 뜬다
    expect(markup).toContain("fan aiming");
    expect(markup).toContain("대상을 고르세요");
    expect(markup).not.toContain("card_zeus_19 ·");
  });

  /**
   * 강화와 토큰이 카드 면에 보이는가(P-62). 「작은 번개」는 원문이 피해 5고 `+1`이면 7이다 —
   * 위력 3 · 광란이 붙은 손에서 실제로 나가는 값은 12다(`attackPreview`). 화면은 **원문과 지금 값
   * 둘만** 적는다: 중간 단계(7)는 안 적는다
   */
  it("strikes the written value and stands up what the card will actually deal", () => {
    const raised = upgraded(cards.find(({ id }) => id === "card_zeus_01")!, 1);
    expect(raised.effects[0].value, "규칙이 5 → 7이다").toBe(7);
    const decision = {
      phase: "card",
      options: [raised.id, endTurnAction],
      bot: endTurnAction,
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], favor: { zeus: 40, athena: 40 }, grace: {}, deck: [],
        turn: 5, block: 0, energy: 3, draw: 4, tokens: { might: 3, frenzy: 1 }, powers: [],
        hand: [{ id: raised.id, name: raised.name, cost: raised.cost, target: raised.target, effects: raised.effects }],
        enemies: [{ id: "enemy_under_guardian", slot: 0, span: 1, hp: 20, maxHp: 30, block: 0, tokens: {}, passives: {}, intent: { damage: 9 } }],
        hits: [], hitSeq: 0, guarded: [], promises: [],
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    // 원문 5는 취소선으로 남고 12가 크게 선다 — 취소선이 흑백에서도 남는 채널이라 색만으로 안 말한다
    expect(markup).toContain("<s>5</s><b class=\"up\">12</b>");
    expect(markup).not.toContain(">7<");
    // `+N`은 이름에서 떨어져 배지가 됐다 — 캡션은 원문 이름이고 `aria-label`이 문장을 든다
    expect(markup).toContain('<em class="card-up">+1</em>');
    expect(markup).toContain(">작은 번개</small>");
    expect(markup).toContain('aria-label="작은 번개+1 · 1 에너지 · ▮▮▮▮ 전체 · 피해 12"');
  });

  it("shows sabotage in the reserved row and on the weakened card", () => {
    const base = cards.find(({ id }) => id === "card_athena_01")!;
    const weakened = { ...base, effects: [{ ...base.effects[0], value: 3 }, base.effects[1]], weakened: true };
    const decision = {
      phase: "card", options: [base.id, endTurnAction], bot: endTurnAction,
      observation: {
        depth: 1, lane: 1, region: "underworld", floor: 1, hp: 50, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], favor: { zeus: 29, athena: 71 }, grace: {}, deck: [],
        turn: 1, block: 0, energy: 3, draw: 4, tokens: {}, powers: [], hand: [weakened],
        sabotages: [{ god: "zeus", patron: "athena" }], enemies: [], hits: [], hitSeq: 0, guarded: [], promises: [],
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(CombatScreen, { seed: 1, decision, onAnswer: () => {} }));

    expect(markup).toContain("제우스 분노 · 아테나 카드 −1");
    expect(markup).toContain("분노한 제우스의 훼방 — 아테나 카드의 피해·방어·연쇄 −1 · 제우스 호의가 평온으로 돌아오면 해제");
    expect(markup).toContain('class="game-card weakened"');
    expect(markup).toContain('<s>4</s><b class="down">3</b>');
  });

  /**
   * 쉼터의 강화 후보는 **고른 뒤와 같은 얼굴**로 선다 — 값은 `upgraded` 하나가 만들고,
   * e2e가 읽는 `data-card`·`data-cost`·`data-damage` 셋은 덱에 실제로 있는 카드의 것 그대로다
   */
  it("shows the rest node's upgrade candidates as they will look once picked", () => {
    const deck = ["card_zeus_01", "card_athena_01"].map((id) => {
      const { name, cost, target, effects } = cards.find((card) => card.id === id)!;
      return { id, name, cost, target, effects };
    });
    const decision = {
      phase: "rest_card",
      options: ["card_zeus_01"],
      bot: "card_zeus_01",
      observation: {
        depth: 3, lane: 1, region: "underworld", floor: 4, hp: 44, maxHp: 92,
        patrons: ["zeus", "athena"], grid: [], favor: { zeus: 40, athena: 40 }, grace: {}, deck,
      },
    } as never;
    const markup = renderToStaticMarkup(createElement(RestScreen, { decision, upgrading: true, onAnswer: () => {} }));

    expect(markup).toContain("<s>5</s><b class=\"up\">7</b>");
    expect(markup).toContain('<em class="card-up">+1</em>');
    // 클릭 계약은 덱의 id다 — 미리보기가 `card_zeus_01+1`을 실으면 e2e가 없는 카드를 고른다
    expect(markup).toContain('data-card="card_zeus_01"');
    expect(markup).not.toContain('data-card="card_zeus_01+1"');
    // 못 고르는 칸(강화 후보가 아닌 카드)은 지금 얼굴 그대로다 — 거짓 약속을 안 한다
    expect(markup.split('data-card="card_athena_01"')[1]).not.toContain("<s>");
    // 제거 화면은 같은 `rest_card`지만 얼굴이 안 바뀐다
    expect(renderToStaticMarkup(createElement(RestScreen, { decision, onAnswer: () => {} }))).not.toContain("<s>");
  });

  // 첫 화면은 타이틀이다 — 메뉴 셋(시작·통계 링크·전체화면)이 서고, setup의 폼은 아직 없다
  it("renders the intro screen first", () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("신들의 저울");
    expect(markup).toContain("게임 시작");
    // 시뮬 통계는 시작 화면에서 인트로로 이사했다(P-56) — 페이지 이동이라 버튼이 아니라 링크다
    expect(markup.match(/<nav class="intro-menu">.*?<\/nav>/s)?.[0]).toContain("stats.html");
    expect(markup.match(/<nav class="intro-menu">.*?<\/nav>/s)?.[0].match(/<button/g)).toHaveLength(2);
    // 「결정론적 덱빌딩 프로토타입」은 이제 사실도 아니다
    expect(markup).not.toContain("프로토타입");
    expect(markup).not.toContain("런 시작");
  });

  it("loops music only on the main and result screens", () => {
    expect(musicForScreen("intro")).toContain("Beneath_the_Iron_Altar");
    expect(musicForScreen("setup")).toBe(musicForScreen("intro"));
    expect(musicForScreen("result")).toContain("Beneath_the_Golden_Banner");
    for (const screen of ["opening", "map", "combat", "rest", "reward"]) expect(musicForScreen(screen), screen).toBeUndefined();

    const markup = renderToStaticMarkup(createElement(App));
    expect(markup).toContain("<audio");
    expect(markup).toContain("loop=\"\"");
  });

  it("plays shipped effects at the requested volume", () => {
    const nativeAudio = globalThis.Audio;
    const wasEnabled = sound.enabled;
    const made: { src: string; volume: number }[] = [];
    globalThis.Audio = class {
      volume = 1;
      constructor(readonly src: string) { made.push(this); }
      play() { return Promise.resolve(); }
    } as unknown as typeof Audio;
    try {
      for (const name of ["card-place-4", "turn-end", "attack", "hit", "guard", "enemy-death"]) playSound(name, 0.12);
      expect(made.map(({ src }) => src)).toEqual(expect.arrayContaining(["card-place-4", "turn-end", "attack", "hit", "guard", "enemy-death"].map((name) => expect.stringContaining(name))));
      expect(made).toHaveLength(6);
      expect(made.every(({ volume }) => volume === 0.12)).toBe(true);
      sound.enabled = false;
      playSound("card-slide-6");
      expect(made).toHaveLength(6);
    } finally {
      sound.enabled = wasEnabled;
      globalThis.Audio = nativeAudio;
    }
  });

  it("renders the setup screen through React", () => {
    const markup = renderToStaticMarkup(createElement(App, { intro: false }));

    expect(markup).toContain("전체 카드");
    expect(markup).toContain("후원할 신 둘 · 2/2");
    expect(markup).toContain("런 시작");
    // 시드 입력이 없다(P-56) — 재현은 `?seed=` URL과 반출 JSON이 든다
    expect(markup).not.toContain("런 시드");
    expect(markup).not.toContain('type="number"');
    // 다섯이 다 눌리는 초상 버튼이고 기본으로 눌린 것은 둘이다 — 안 고르고 시작하던 사람이 같은 런을 얻는다
    const select = markup.match(/<div class="god-select".*?<\/div>/s)?.[0] ?? "";
    expect(select.match(/aria-pressed/g)).toHaveLength(5);
    expect(select.match(/aria-pressed="true"/g)).toHaveLength(2);
    // 「선택 N」 배지는 data-pick + CSS content다 — DOM 텍스트에 섞으면 e2e가 이름으로 버튼을 못 집는다
    expect(select.match(/data-pick="1"/g)).toHaveLength(1);
    expect(select.match(/data-pick="2"/g)).toHaveLength(1);
    // 선택한 둘만 헌신 능력을 짧게 보여 준다. 문장은 전투 상태 바와 같은 실제 효과 데이터에서 온다
    expect(select.match(/class="god-ability"/g)).toHaveLength(2);
    expect(select).toContain("시작 적 하나에게 피해 8 · 3턴마다 적 하나에게 감전 1");
    expect(select).toContain("시작 나에게 반사 1 · 3턴마다 나에게 방어 3");
    // 둘이므로 「런 시작」이 눌린다 — 폼 안에서 `disabled`가 붙는 자리는 그것 하나뿐이다.
    // 전역 아이콘의 덱·약속(P-53)은 런 밖이라 죽어 있다 — 지우지 않고 `disabled`가 정답이다(UI.md)
    expect(markup.match(/<form[\s\S]*<\/form>/)?.[0] ?? "").not.toContain("disabled");
    // 호의 배분은 시작 화면에서 빠지고 시작 덱 설정 모달을 열어야 나온다
    expect(markup).toContain("시작 덱 설정 · 10/10장");
    expect(markup).not.toContain("시작 호의 배분");
    // 편집기는 한 방향 문이 아니다 — 조합을 하나로 줄여 슬롯을 비운 사람이 여기로 돌아온다
    expect(markup).not.toContain("규칙 덱으로");
  });

  it("shows every card in the card catalog", () => {
    const markup = renderToStaticMarkup(createElement(CardCatalog));

    expect(allCards).toHaveLength(cards.length);
    expect(markup.match(/class="game-card/g)).toHaveLength(cards.length);
    expect(markup.match(/<em class="card-kind">소멸<\/em>/g)).toHaveLength(4);
    expect(markup.match(/aria-pressed/g)).toHaveLength(7);
    for (const name of ["전체", "제우스", "포세이돈", "아테나", "아레스", "아르테미스", "융합"]) expect(markup).toContain(name);
  });

  it("shows both selected gods before entering the run", () => {
    const markup = renderToStaticMarkup(createElement(RunOpening, { patrons: ["zeus", "athena"], onDone: () => {} }));

    expect(markup.match(/<video/g)).toHaveLength(2);
    expect(markup).toContain("제우스");
    expect(markup).toContain("아테나");
    expect(markup).toContain("두 신이 한 인간의 운명을 두고 맞섭니다.");
    expect(markup.match(/autoplay/gi)).toHaveLength(2);
    expect(markup.match(/muted/gi)).toHaveLength(2);
    expect(markup.match(/playsinline/gi)).toHaveLength(2);
    expect(markup).toContain('<button class="opening-skip" type="button" aria-label="영상 건너뛰기"></button>');
    expect(Object.keys(import.meta.glob("../art/gods/*.mp4")).map((path) => path.replace(/^.*\//, "")).sort()).toEqual([
      "ares.mp4", "artemis.mp4", "athena.mp4", "poseidon.mp4", "zeus.mp4",
    ]);
  });

  /**
   * 전체화면 버튼은 열 화면 어디에나 같은 자리에 서므로 화면 전환 밖이고 **`form.setup` 바깥이다** —
   * `<button>`의 기본값이 submit이라, 폼 안으로 옮기는 사람이 이 버튼으로 런을 시작시킨다
   */
  it("stands the fullscreen button outside the setup form", () => {
    const markup = renderToStaticMarkup(createElement(App, { intro: false }));

    expect(markup).toContain('<button type="button" class="fullscreen">전체화면</button>');
    expect(markup.match(/<form[\s\S]*<\/form>/)?.[0] ?? "").not.toContain("fullscreen");
  });

  /**
   * 조건부 효과는 화면에서 흐려진다 — **왜 흐린지**는 `title`과 `aria-label`이 든다. 표에 없는 조건은
   * DSL 원문이 그대로 나가므로, 데이터에 여섯째 조건이 붙는 날 이 줄이 그것을 잡는다
   */
  it("names every shipped condition in Korean instead of printing the DSL", () => {
    const shipped = new Set([cardDataJson, graceDataJson]
      .flatMap((rows) => (rows as { effects: { when?: string }[] }[])
        .flatMap(({ effects }) => effects.map(({ when }) => when).filter(Boolean) as string[])));
    expect(shipped.size).toBeGreaterThan(0);
    for (const when of shipped) expect(conditionLabel(when), when).not.toBe(when);
  });

  /**
   * 고른 순서는 결정이 아니다 — 시작 덱이 `patrons[0]`에게 2·2·1, `[1]`에게 3·1·1을 주므로
   * 정규화를 빼먹으면 같은 조합이 두 게임이 되고, 화면에는 아무 표시도 안 난다
   */
  it("plays the same run whichever order the two gods were picked", () => {
    expect(patronPair(["athena", "zeus"])).toEqual(["zeus", "athena"]);
    expect(run(9, undefined, [], patronPair(["artemis", "poseidon"])).actions)
      .toEqual(run(9, undefined, [], patronPair(["poseidon", "artemis"])).actions);
  });

  it("replays the same outcome, progress, and final favor", () => {
    // 봇이 실제로 걸은 갈래를 기록으로 되먹인다 — 갈래 문자열이 이제 격자에 달려 있어 상수로 못 적는다
    const actions: ReplayAction[] = run(42).actions.filter(({ type }) => type === "path");
    const browser = run(42, undefined, actions);
    const replay = replayPayload(42, actions, ["zeus", "athena"]);
    const cli = run(replay.seed, undefined, replay.actions, replay.patrons);

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
    // 아홉 종류를 다 지나는 자리가 92다
    let diverged = false;
    const { result: browser, actions } = playByHand(92, (decision) => {
      const { phase, options, bot } = decision;
      if (phase === "path") return pickPath(decision, "rest");
      if (phase === "rest") return "remove";
      // 답이 신의 이름이다 — 첫 제안을 고른다
      if (phase === "demand") return options[0];
      if (phase !== "card" || diverged) return bot;
      const other = options.find((option) => option !== bot && option !== endTurnAction);
      diverged = Boolean(other);
      return other ?? bot;
    });
    const replay = replayPayload(92, actions, ["zeus", "athena"]);
    const cli = run(replay.seed, undefined, replay.actions, replay.patrons);

    // 반출에 사람이 고른 아홉 종류가 전부 있어야 한다 — 빠지면 재생 때 봇이 대신 채운다
    for (const type of ["path", "card", "target", "rest", "rest_card", "reward", "grace", "grace_card", "demand"]) {
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
 * 격자가 유일한 조작 면이 됐다(P-42). 보는 것은 셋이다 — 마커가 안 뜨던 두 화면(저승 1층·지상 1층),
 * 열린 갈래만 눌린다는 것, 결과 화면의 같은 격자가 읽는 그림으로 남는다는 것.
 * **이동 중 전 칸 잠김은 여기서 못 본다** — 클릭이 필요하고 vitest 환경에 DOM이 없다(`npm run e2e`가 본다)
 */
describe("지도를 걷는다", () => {
  const grid = generateMap(7);
  const walkable = (region: string, depth: number) =>
    renderToStaticMarkup(createElement(MapPanel, {
      grid,
      region,
      here: { depth, lane: bossLane },
      open: { depth: depth + 1, options: ["0:combat", "1:combat", "2:combat"] },
      onEnter: () => {},
    }));

  it("마커가 저승 1층·지상 1층에도 선다", () => {
    // 시작 칸이 없으면 12화면 중 이 둘에서 마커가 사라진다 — `here.depth`가 −1과 5라 격자에 자리가 없다
    for (const [region, depth, label] of [["underworld", -1, "시작"], ["surface", 5, "지하에서"]] as const) {
      const markup = walkable(region, depth);
      expect(markup, region).toContain(label);
      // 마커는 그 칸 **안에** 선다 — 밖에 있으면 `layoutId`가 옮길 것이 없다
      expect(markup.match(/class="map-node here"[^>]*>(.*?)<\/i>/s)?.[1] ?? "", region).toContain("marker");
    }
  });

  it("열린 갈래만 눌린다", () => {
    const buttons = [...walkable("underworld", -1).matchAll(/<button class="map-node ([^"]*)"([^>]*)>/g)];
    // 5층 × 3갈래 + 보스 하나. 보스 층의 빈 두 자리는 `<i>`로 남아 버튼이 아니다
    expect(buttons).toHaveLength(16);
    const [open, locked] = [buttons.filter(([, cls]) => cls.includes("open")), buttons.filter(([, cls]) => !cls.includes("open"))];
    expect(open).toHaveLength(3);
    expect(open.filter(([, , rest]) => rest.includes("disabled"))).toEqual([]);
    expect(locked.filter(([, , rest]) => !rest.includes("disabled"))).toEqual([]);
    // 갈래 이름은 화면에서 사라지고 여기 남는다 — 격자에는 위치가 있지만 스크린리더에는 없다
    expect(open[0][2]).toContain('aria-label="왼쪽 · 전투 · 보상을 노리고');
  });

  it("결과 화면의 같은 격자는 눌리지 않는다", () => {
    const markup = renderToStaticMarkup(createElement(MapPanel, { grid, region: "underworld", taken: [] }));
    expect(markup).not.toContain("<button");
    // 크기는 `.walkable`에만 붙는다 — 경로 화면이 760px 판에 72px 칸을 깔아도 결과 화면은 30px 칸
    // 둘을 `0.8fr` 열에 나란히 세운다
    expect(markup).not.toContain("walkable");
  });
});

/**
 * 149개 id를 그림 30장이 덮는 규칙(`ui/art-keys.ts`)만 본다 — 파일이 실제로 있는지는
 * `npm run art -- --check`가 전수로 대조한다. **함정 둘이 이 한 줄에 다 걸린다**: 후보에서 `id`를
 * 빼면 융합 10장이, `tags[0]`에서 멈추면 첫 태그가 `power`인 다섯 장이 여기서 안 떨어진다
 */
describe("카드 그림 폴백", () => {
  it("149개 id가 전부 그림 한 장으로 떨어진다", () => {
    const have = new Set(Object.keys(import.meta.glob("../art/cards/*.webp")).map((path) => path.replace(/^.*\/|\.webp$/g, "")));
    expect((cardDataJson as CardArtSource[]).filter((card) => !cardArtCandidates(card).some((key) => have.has(key)))).toEqual([]);
  });
});

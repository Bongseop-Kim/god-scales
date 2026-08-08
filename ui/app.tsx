// `domMax`는 `domAnimation` + drag + **layout**이다 — 적이 자리를 맞바꿀 때 미끄러지는 데 그 셋째가 필요하다
import { AnimatePresence, LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { GodId } from "../core/rules.ts";
import { deckSize, endTurnAction, favorPool, gods, ruleDeck, runSteps, type Decision, type PatronPair } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { BetScreen, DemandScreen, GraceScreen, OracleScreen, RestScreen } from "./screens/choices.tsx";
import { CombatScreen } from "./screens/combat.tsx";
import { IconSheet } from "./shared/icon.tsx";
import { MapScreen } from "./screens/map.tsx";
import { ResultScreen } from "./screens/result.tsx";
import { RewardScreen } from "./screens/reward.tsx";
import { FullscreenButton, IntroScreen, SetupScreen } from "./screens/setup.tsx";
import { StatusBar } from "./shared/header.tsx";
import { DeckPanel, HelpPanel, JournalPanel, Overlay, type PromiseRecord } from "./shared/overlay.tsx";
import { playSound, sound } from "./shared/sfx.ts";
import { TokenDictionary } from "./shared/tokens.tsx";
import "./motion.css";
import "./style.css";

type Steps = Generator<Decision, RunResult, string>;
/** 오버레이 넷. 열림 상태는 여기(App)가 든다 — URL·저장에 싣지 않으므로 새로고침하면 닫힌 상태다 */
type OverlayKind = "tokens" | "help" | "deck" | "journal";

/** 화면 전환 애니메이션의 key. 여기 없는 phase는 이름 그대로 자기 화면이다 */
const screens: Partial<Record<Decision["phase"], string>> = { path: "map", rest_card: "rest", card: "combat", target: "combat" };

/**
 * 화면 전환. **런 하나에 약 36번 돈다** — `mode="wait"`가 퇴장이 끝난 뒤에 등장을 붙이므로 한 번의
 * 전환은 퇴장 + 등장이다. 방향은 축 하나다: 새 화면은 아래에서 올라오고 옛 화면은 위로 빠진다.
 * 전환 쌍마다 다른 연출을 만들지 않는다 — 화면이 하나 늘 때마다 칸이 여덟 개 늘기 때문이다
 */
const screenTransition = (duration: number) => ({ duration, ease: [0.23, 1, 0.32, 1] } as const);

/**
 * 조합은 집합이지 순서열이 아니다 — 고른 순서를 그대로 넘기면 시작 덱이 `[0]`에게 2·2·1, `[1]`에게
 * 3·1·1을 주므로(`sim/engine.ts`) 같은 조합이 두 게임이 된다. 엔진의 `gods` 순서로 굳혀 하나로 만든다
 */
export const patronPair = (picked: readonly GodId[]): PatronPair => gods.filter((god) => picked.includes(god)) as unknown as PatronPair;

export function App({ intro: introAtStart = true, seed: fixedSeed }: {
  intro?: boolean;
  /** 개발·e2e용 고정 시드 — `main.tsx`가 `?seed=`에서 읽어 넘긴다. 없으면 런마다 새로 뽑는다(P-56) */
  seed?: number;
}) {
  /** 타이틀 화면. 페이지당 한 번만 선다 — 「다시 시작」은 setup으로 돌아간다(`tools/e2e.ts`가 그렇게 기다린다).
      prop은 초기값일 뿐이다 — 클릭 없이 그리는 `test/ui.test.ts`가 setup을 볼 유일한 문이다 */
  const [intro, setIntro] = useState(introAtStart);
  const [seed, setSeed] = useState(fixedSeed ?? 1);
  const [picked, setPicked] = useState<GodId[]>(["zeus", "athena"]);
  /** 지금 돌고 있는 조합. `picked`와 나누는 이유는 `seed`를 `seedInput`과 나누는 이유와 같다 */
  const [patrons, setPatrons] = useState<PatronPair>(["zeus", "athena"]);
  /**
   * 사람이 짠 시작 덱. **`undefined`가 「손대지 않았다」다** — 그러면 엔진도 반출도 규칙 덱으로 간다.
   * `patrons`처럼 둘로 나누지 않는다: 편집기는 시작 화면에만 있고 런 중에는 그 화면이 없다
   */
  const [deck, setDeck] = useState<string[]>();
  /**
   * `patrons[0]`이 가진 몫. **런 중에 다시 묻지 않으므로** `picked`처럼 둘로 나누지 않는다 —
   * 시작 화면은 런이 도는 동안 없다(`deck`과 같은 자리, 같은 이유)
   */
  const [split, setSplit] = useState(favorPool / 2);
  const [actions, setActions] = useState<ReplayAction[]>([]);
  const [pending, setPending] = useState<Decision>();
  const [result, setResult] = useState<RunResult>();
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const [overlay, setOverlay] = useState<OverlayKind>();
  /** 지킴·깨짐 히스토리. `actions` 배열과 같은 꼴의 표시용 누적이지 게임 상태가 아니다 */
  const [journal, setJournal] = useState<PromiseRecord[]>([]);
  /** 같은 확정을 두 번 쌓지 않는다 — `settled`는 확정 뒤에도 매 관측에 그대로 실려 온다 */
  const settledSeen = useRef(new Set<string>());
  const steps = useRef<Steps>(null);
  // 퇴장 애니메이션 중인 카드의 onClick은 옛 pending을 클로저에 들고 있다. 판정은 언제나 최신 결정으로 한다
  const latest = useRef<Decision>(null);
  const reducedMotion = useReducedMotion();
  const screen = intro ? "intro" : result ? "result" : pending ? screens[pending.phase] ?? pending.phase : "setup";
  const pair = picked.length === 2 ? patronPair(picked) : undefined;
  /** 편집기가 그리는 열 장. 손대지 않았으면 규칙이 뽑은 것 그대로다 */
  const startingDeck = deck ?? (pair ? ruleDeck(pair) : []);

  const show = (decision?: Decision) => {
    latest.current = decision ?? null;
    setPending(decision);
    // 약속 히스토리는 관측 스트림에서 줍는다 — 화면이 규칙을 다시 재지 않고, 엔진에 새 API도 없다
    const view = decision?.observation;
    if (view && "promises" in view) {
      for (const { god, rule, settled } of view.promises) {
        const key = `${view.depth}:${god}:${rule}`;
        if (!settled || settledSeen.current.has(key)) continue;
        settledSeen.current.add(key);
        setJournal((all) => [...all, { god, rule, region: view.region, floor: view.floor, settled }]);
      }
    }
  };

  const reset = () => {
    steps.current = null;
    show(undefined);
    setActions([]);
    setResult(undefined);
    setJournal([]);
    settledSeen.current.clear();
  };

  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 둘이 아니거나 열 장이 아니면 submit이 `disabled`다 — 그래도 여기 닿으면 엔진이 던진다
    if (!pair || startingDeck.length !== deckSize) return;
    /**
     * 시드 입력이 사라졌다(P-56) — `?seed=`(개발·e2e)가 있으면 그것, 없으면 런마다 새로 뽑는다.
     * 반출 JSON에는 그대로 남으므로 재현의 근거는 잃지 않는다. 정수 검증은 입력과 같이 죽었다
     */
    const nextSeed = fixedSeed ?? Math.floor(Math.random() * 2 ** 31) + 1;
    setSeed(nextSeed);
    setPatrons(pair);
    // `deck`을 그대로 넘긴다 — 손대지 않은 `undefined`가 곧 규칙 덱이다
    steps.current = runSteps(nextSeed, undefined, pair, deck, split);
    const step = steps.current.next();
    if (step.done) setResult(step.value);
    else show(step.value);
    playSound("start");
  };

  // 엔진이 물은 phase 그대로 답한다. UI는 게임 상태를 갖지 않는다 — 그린 것은 전부 마지막 yield의 observation이다
  const answer = (choice: string) => {
    const current = latest.current;
    // options에 없는 값은 엔진에 보내지 않는다. 이미 지나간 결정에 눌린 카드가 여기서 걸린다
    if (!current || !steps.current || !current.options.includes(choice)) return;
    const step = steps.current.next(choice);
    setActions((all) => [...all, { type: current.phase, choice } as ReplayAction]);
    if (step.done) {
      show(undefined);
      setResult(step.value);
    } else show(step.value);
  };

  /**
   * 단축키(P-58) — D 덱 · J 약속 · T 토큰 사전 · ? 도움말 · E 턴 종료 · 1~9 카드.
   * Esc는 `<dialog>`가 이미 든다. 판정은 언제나 `latest`(최신 결정)와 `answer`의 options 검사로
   * 하므로 지나간 결정에 눌린 키는 조용히 무시된다 — 클릭과 같은 문이다
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const current = latest.current;
      if (event.key === "?") setOverlay("help");
      else if (key === "t") setOverlay("tokens");
      else if (key === "d" && current) setOverlay("deck");
      else if (key === "j" && current) setOverlay("journal");
      /**
       * 오버레이가 열려 있으면 게임 단축키는 닫힌다 — 모달 위에서 누른 1이 뒤에 있는 카드를 내면
       * 안 된다. 열림은 `<dialog open>`이 든다: 이 리스너는 한 번만 걸리므로 `overlay` state를 읽으면
       * 첫 렌더 값에 갇힌다. 위 넷은 남는다 — 사전에서 도움말로 바로 넘어가는 문이다
       */
      else if (document.querySelector("dialog[open]")) return;
      else if (key === "e" && current?.phase === "card") answer(endTurnAction);
      else if (/^[1-9]$/.test(key) && current?.phase === "card") {
        const card = current.observation.hand[Number(key) - 1];
        if (card) answer(card.id);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
    // `answer`·`latest`는 ref와 안정한 setState만 만진다 — 한 번 걸면 된다
  }, []);

  // 셋째를 누르면 가장 오래된 것이 빠진다 — 「먼저 해제하세요」를 만들지 않는다
  const toggleGod = (god: GodId) =>
    setPicked((now) => (now.includes(god) ? now.filter((id) => id !== god) : [...now, god].slice(-2)));

  const toggleSound = () => {
    const enabled = !soundEnabled;
    sound.enabled = enabled;
    setSoundEnabled(enabled);
  };

  // 시작·결과는 런당 한 번뿐이라 길어도 된다. 나머지 여섯 화면은 ~36번 도는 자리라 짧다
  const slow = screen === "intro" || screen === "setup" || screen === "result";
  const enter = reducedMotion ? { duration: 0 } : screenTransition(slow ? 0.32 : 0.16);
  const leave = reducedMotion ? { duration: 0 } : screenTransition(slow ? 0.32 : 0.12);

  return (
    <LazyMotion features={domMax}>
      {/* 아이콘 시트는 **화면 전환 밖**에 선다 — `AnimatePresence` 안에 넣으면 전환마다 `<use>`가 가리킬
          대상이 사라졌다 다시 생긴다 */}
      <IconSheet />
      {/* 아이콘 시트와 같은 이유로 전환 밖이다 — 열 화면 어디에나 같은 자리에 서야 한다. 인트로만 예외:
          메뉴에 큰 것이 서므로 구석의 작은 것은 중복이다 */}
      {screen !== "intro" && <FullscreenButton />}
      {/**
        * 전역 아이콘 셋(P-53) — 우상단 fixed, 셸 밖, zoom 미적용. 소리 토글은 시작 화면의
        * 버튼을 대체했다. 덱·약속 둘은 상태 바(P-54)로 이사했다 — 런 밖에는 덱도 약속도 없다
        */}
      <nav className="global-icons" aria-label="전역 메뉴">
        <button type="button" aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? "소리 켜짐" : "소리 꺼짐"}</button>
        <button type="button" onClick={() => setOverlay("tokens")}>토큰</button>
        <button type="button" onClick={() => setOverlay("help")}>도움말</button>
      </nav>
      {/**
        * 상단 상태 바(P-54) — 여덟 런 화면의 값(체력·호의·위치·덱·약속)을 하나가 든다.
        * **화면 전환 밖**이다: 안에 넣으면 런당 ~36번 다시 서고 경계 펄스의 ref가 그때마다 리셋된다
        */}
      {pending && (
        <StatusBar
          view={pending.observation}
          turn={"turn" in pending.observation ? pending.observation.turn : undefined}
          block={"block" in pending.observation ? pending.observation.block : undefined}
          onOverlay={setOverlay}
        />
      )}
      {overlay === "tokens" && (
        <Overlay title="상태 토큰" onClose={() => setOverlay(undefined)}><TokenDictionary /></Overlay>
      )}
      {overlay === "help" && (
        <Overlay title="도움말" onClose={() => setOverlay(undefined)}><HelpPanel /></Overlay>
      )}
      {overlay === "deck" && pending && (
        <Overlay wide title={`덱 ${pending.observation.deck.length}장`} onClose={() => setOverlay(undefined)}>
          <DeckPanel deck={pending.observation.deck} />
        </Overlay>
      )}
      {overlay === "journal" && pending && (
        <Overlay title="약속" onClose={() => setOverlay(undefined)}>
          <JournalPanel active={"promises" in pending.observation ? pending.observation.promises : []} history={journal} />
        </Overlay>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {/**
         * E2E(`npm run e2e`)가 읽는 두 값이다. `data-phase`는 지금 무엇을 묻는지, `data-step`은 답한
         * 결정의 수 — 클릭이 실제로 엔진을 한 칸 움직였는지 이것 하나로 안다. 화면 텍스트를 긁는 것보다 짧다
         */}
        <m.section
          key={screen}
          data-phase={pending?.phase ?? screen}
          data-step={actions.length}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: enter }}
          exit={{ opacity: 0, y: -6, transition: leave }}
        >
          {screen === "intro" && <IntroScreen onStart={() => setIntro(false)} />}
          {screen === "setup" && (
            <SetupScreen
              picked={picked}
              deck={startingDeck}
              pair={pair}
              split={split}
              onSplitChange={setSplit}
              onToggleGod={toggleGod}
              onDeckChange={setDeck}
              onRestoreDeck={() => setDeck(undefined)}
              onStart={start}
            />
          )}
          {pending?.phase === "path" && (
            <MapScreen decision={pending} onChoosePath={answer} />
          )}
          {(pending?.phase === "card" || pending?.phase === "target") && (
            <CombatScreen seed={seed} decision={pending} onAnswer={answer} onOpenJournal={() => setOverlay("journal")} />
          )}
          {(pending?.phase === "rest" || pending?.phase === "rest_card") && (
            <RestScreen decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "reward" && (
            <RewardScreen decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "grace" && (
            <GraceScreen decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "demand" && (
            <DemandScreen decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "bet_card" && (
            <BetScreen decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "oracle" && (
            <OracleScreen decision={pending} onAnswer={answer} />
          )}
          {screen === "result" && result && (
            <ResultScreen seed={seed} patrons={patrons} deck={deck} split={split} actions={actions} result={result} onReset={reset} />
          )}
        </m.section>
      </AnimatePresence>
    </LazyMotion>
  );
}

// `domMax`는 `domAnimation` + drag + **layout**이다 — 적이 자리를 맞바꿀 때 미끄러지는 데 그 셋째가 필요하다
import { AnimatePresence, LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { GodId } from "../core/rules.ts";
import { allCards, deckSize, endTurnAction, favorPool, gods, ruleDeck, runSteps, type CardView, type CombatObservation, type Decision, type PatronPair } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { DemandScreen, GraceScreen, RestScreen } from "./screens/choices.tsx";
import { CombatScreen } from "./screens/combat.tsx";
import { CardSigns, GameCard } from "./shared/card.tsx";
import { Icon, IconSheet } from "./shared/icon.tsx";
import { MapScreen } from "./screens/map.tsx";
import { ResultScreen } from "./screens/result.tsx";
import { RewardScreen } from "./screens/reward.tsx";
import { FullscreenButton, IntroScreen, SetupScreen, type Achievement } from "./screens/setup.tsx";
import { godArt, godLines, godName, StatusBar } from "./shared/header.tsx";
import { resetSpokenLines, speak } from "./shared/fx.ts";
import { CardCatalog, DeckPanel, HelpPanel, JournalPanel, Overlay, type PromiseRecord } from "./shared/overlay.tsx";
import { musicForScreen, playSound, sound } from "./shared/sfx.ts";
import { TokenDictionary } from "./shared/tokens.tsx";
import { particleStrip } from "./shared/art-keys.ts";
import "./motion.css";
import "./style.css";

type Steps = Generator<Decision, RunResult, string>;
/** 오버레이 다섯. 열림 상태는 여기(App)가 든다 — URL·저장에 싣지 않으므로 새로고침하면 닫힌 상태다 */
type OverlayKind = "tokens" | "help" | "cards" | "deck" | "journal" | "restart";

/** 화면 전환 애니메이션의 key. 여기 없는 phase는 이름 그대로 자기 화면이다 */
const screens: Partial<Record<Decision["phase"], string>> = { path: "map", rest_card: "rest", grace_card: "grace", card: "combat", target: "combat" };
const godVideos = import.meta.glob<string>("../art/gods/*.mp4", { eager: true, query: "?url", import: "default" });
const particleArt = import.meta.glob<string>("../art/particle/*.webp", { eager: true, query: "?url", import: "default" });

/** 선택한 두 신의 영상이 모두 끝나야 첫 지도가 열린다. 실패한 영상은 런을 가두지 않고 끝난 것으로 친다 */
export function RunOpening({ patrons, onDone }: { patrons: PatronPair; onDone: () => void }) {
  const finished = useRef(new Set<GodId>());
  const finish = (god: GodId) => {
    if (finished.current.has(god)) return;
    finished.current.add(god);
    if (finished.current.size === patrons.length) onDone();
  };
  return (
    <div className="run-opening">
      {patrons.map((god) => (
        <figure key={god} style={{ "--god-color": `var(--${god})` } as CSSProperties}>
          <video
            autoPlay
            muted
            playsInline
            preload="auto"
            src={godVideos[`../art/gods/${god}.mp4`]}
            onEnded={() => finish(god)}
            onError={() => finish(god)}
          />
        </figure>
      ))}
      <div className="opening-story">
        <strong>
          <b style={{ color: `var(--${patrons[0]})` }}>{godName(patrons[0])}</b>
          <i>VS</i>
          <b style={{ color: `var(--${patrons[1]})` }}>{godName(patrons[1])}</b>
        </strong>
        <p>두 신이 한 인간의 운명을 두고 맞섭니다.</p>
      </div>
      <button className="opening-skip" type="button" aria-label="영상 건너뛰기" onClick={onDone} />
    </div>
  );
}

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
  const [opening, setOpening] = useState<PatronPair>();
  const [result, setResult] = useState<RunResult>();
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const [overlay, setOverlay] = useState<OverlayKind>();
  const [fusion, setFusion] = useState<{ source: CardView; result: CardView; patrons: PatronPair }>();
  const [outro, setOutro] = useState<{ kind: "won" | "lost"; finale: CombatObservation }>();
  /** 지킴·깨짐 히스토리. `actions` 배열과 같은 꼴의 표시용 누적이지 게임 상태가 아니다 */
  const [journal, setJournal] = useState<PromiseRecord[]>([]);
  /** 같은 확정을 두 번 쌓지 않는다 — `settled`는 확정 뒤에도 매 관측에 그대로 실려 온다 */
  const settledSeen = useRef(new Set<string>());
  const questCutinsSeen = useRef(new Set<string>());
  const music = useRef<HTMLAudioElement>(null);
  const outroTimer = useRef<number>(undefined);
  const leavingCombatOutro = useRef(false);
  const steps = useRef<Steps>(null);
  // 퇴장 애니메이션 중인 카드의 onClick은 옛 pending을 클로저에 들고 있다. 판정은 언제나 최신 결정으로 한다
  const latest = useRef<Decision>(null);
  const reducedMotion = useReducedMotion();
  const screen = intro ? "intro" : opening ? "opening" : result ? "result" : pending ? screens[pending.phase] ?? pending.phase : "setup";
  const musicUrl = musicForScreen(screen);
  const pair = picked.length === 2 ? patronPair(picked) : undefined;
  /** 편집기가 그리는 열 장. 손대지 않았으면 규칙이 뽑은 것 그대로다 */
  const startingDeck = deck ?? (pair ? ruleDeck(pair) : []);

  useEffect(() => {
    if (!fusion) return;
    playSound("chips-handle-4", 0.8);
    speak(1, fusion.patrons[0], godLines(fusion.patrons[0], "fuse", seed));
    const second = window.setTimeout(() => speak(1, fusion.patrons[1], godLines(fusion.patrons[1], "fuse", seed)), 320);
    const done = window.setTimeout(() => setFusion(undefined), reducedMotion ? 0 : 2500);
    return () => { clearTimeout(second); clearTimeout(done); };
  }, [fusion, seed]);

  const show = (decision?: Decision) => {
    latest.current = decision ?? null;
    setPending(decision);
    // 과업 히스토리와 컷인은 같은 확정값을 읽는다. 마지막 행동으로 끝난 과업은 보상 관측에서 줍는다
    const view = decision?.observation;
    if (view) {
      const promises = "promises" in view
        ? view.promises
        : "questResult" in view && view.questResult ? [view.questResult] : [];
      for (const { god, rule, current, target, settled } of promises) {
        const key = `${view.depth}:${god}:${rule}`;
        if (!settled || settledSeen.current.has(key)) continue;
        settledSeen.current.add(key);
        setJournal((all) => [...all, { god, rule, region: view.region, floor: view.floor, settled }]);
        if (settled === "kept" && !questCutinsSeen.current.has(key)) {
          questCutinsSeen.current.add(key);
          speak(3, god, `과업 달성 · ${current} / ${target}`, godArt[`../../art/gods/${god}.webp`]);
        }
      }
    }
  };

  const reset = () => {
    clearTimeout(outroTimer.current);
    steps.current = null;
    show(undefined);
    setActions([]);
    setResult(undefined);
    setOutro(undefined);
    leavingCombatOutro.current = false;
    setJournal([]);
    settledSeen.current.clear();
    questCutinsSeen.current.clear();
  };

  const startRun = (nextPair: PatronPair, nextDeck: string[] | undefined, nextSplit: number) => {
    // 열 장이 아니면 일반 submit이 `disabled`다 — 업적도 같은 문으로 들어오므로 여기서 한 번 더 막는다
    if ((nextDeck ?? ruleDeck(nextPair)).length !== deckSize) return;
    /**
     * 시드 입력이 사라졌다(P-56) — `?seed=`(개발·e2e)가 있으면 그것, 없으면 런마다 새로 뽑는다.
     * 반출 JSON에는 그대로 남으므로 재현의 근거는 잃지 않는다. 정수 검증은 입력과 같이 죽었다
     */
    const nextSeed = fixedSeed ?? Math.floor(Math.random() * 2 ** 31) + 1;
    resetSpokenLines();
    setSeed(nextSeed);
    setPatrons(nextPair);
    // `deck`을 그대로 넘긴다 — 손대지 않은 `undefined`가 곧 규칙 덱이다
    steps.current = runSteps(nextSeed, undefined, nextPair, nextDeck, nextSplit);
    if (reducedMotion) enterRun();
    else setOpening(nextPair);
    playSound("chips-handle-4", 0.45);
  };

  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pair) startRun(pair, deck, split);
  };

  const enterRun = () => {
    const step = steps.current!.next();
    setOpening(undefined);
    if (step.done) setResult(step.value);
    else show(step.value);
  };

  // 엔진이 물은 phase 그대로 답한다. UI는 게임 상태를 갖지 않는다 — 그린 것은 전부 마지막 yield의 observation이다
  const answer = (choice: string) => {
    if (outro) return;
    const current = latest.current;
    // options에 없는 값은 엔진에 보내지 않는다. 이미 지나간 결정에 눌린 카드가 여기서 걸린다
    if (!current || !steps.current || !current.options.includes(choice)) return;
    if (current.phase === "grace_card") {
      const source = current.observation.deck.find(({ id }) => id === choice);
      if (source?.fusesTo) setFusion({ source: { ...source, fusesTo: undefined }, result: source.fusesTo, patrons });
    }
    if (choice === endTurnAction) playSound("turn-end", 0.3);
    const step = steps.current.next(choice);
    // 마지막 적은 다음 combat 결정 없이 곧장 보상/결과로 넘어가므로 그 행동의 마지막 관측을 아웃트로가 든다.
    const leftWonCombat = (current.phase === "card" || current.phase === "target")
      && (step.done ? step.value.won : step.value.phase !== "card" && step.value.phase !== "target");
    const leftLostCombat = (current.phase === "card" || current.phase === "target") && step.done && !step.value.won;
    setActions((all) => [...all, { type: current.phase, choice } as ReplayAction]);
    if (leftWonCombat || leftLostCombat) {
      const finale = step.done ? step.value.finale : step.value.phase === "reward" ? step.value.observation.finale : undefined;
      if (!finale) throw new Error("Combat ended without a finale observation");
      latest.current = null;
      setOutro({ kind: leftWonCombat ? "won" : "lost", finale });
      outroTimer.current = window.setTimeout(() => {
        leavingCombatOutro.current = true;
        setOutro(undefined);
        if (step.done) {
          show(undefined);
          setResult(step.value);
        } else show(step.value);
      }, reducedMotion ? 0 : 1300);
      return;
    }
    if (step.done) {
      show(undefined);
      setResult(step.value);
    } else show(step.value);
  };

  /**
   * 단축키(P-58) — D 덱 · J 약속 · T 게임 사전 · ? 도움말 · E 턴 종료 · 1~9 카드.
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

  useEffect(() => {
    const player = music.current;
    if (!player) return;
    const play = () => {
      if (sound.enabled) void player.play().catch(() => {});
    };
    if (!musicUrl || !soundEnabled) {
      player.pause();
      return;
    }
    play();
    // 첫 클릭은 브라우저의 자동 재생 제한을 푼다. 이미 재생 중이면 play()는 그대로 이어 간다.
    document.addEventListener("click", play, { once: true });
    return () => document.removeEventListener("click", play);
  }, [musicUrl, soundEnabled]);

  /**
   * 런이 도는 동안에만 새로고침·탭 닫기를 한 번 묻는다(P-65). **문구는 브라우저 것이다** — 앱이 할 수
   * 있는 것은 「물어보게 만드는 것」까지라 우리 문장을 시도하지 않는다. 결과·시작·타이틀에서는 안 건다:
   * 거기서는 버릴 것이 없고, `tools/e2e.ts`가 탭을 닫는 것도 결과 화면(= `pending` 없음)이다
   */
  const running = Boolean(pending);
  useEffect(() => {
    if (!running) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", ask);
    return () => removeEventListener("beforeunload", ask);
  }, [running]);

  // 셋째를 누르면 가장 오래된 것이 빠진다 — 「먼저 해제하세요」를 만들지 않는다
  const toggleGod = (god: GodId) =>
    setPicked((now) => (now.includes(god) ? now.filter((id) => id !== god) : [...now, god].slice(-2)));

  const startAchievement = ({ pair, split, deck }: Achievement) => {
    setPicked([...pair]);
    setSplit(split);
    setDeck([...deck]);
    startRun(pair, [...deck], split);
  };

  const toggleSound = () => {
    const enabled = !soundEnabled;
    sound.enabled = enabled;
    setSoundEnabled(enabled);
  };

  // 시작·결과는 런당 한 번뿐이라 길어도 된다. 나머지 여섯 화면은 ~36번 도는 자리라 짧다
  const slow = screen === "intro" || screen === "setup" || screen === "opening" || screen === "result";
  const outroTransition = leavingCombatOutro.current && screen !== "combat";
  const enter = reducedMotion ? { duration: 0 } : screenTransition(slow ? 0.4 : 0.26);
  const leave = reducedMotion ? { duration: 0 } : screenTransition(outroTransition ? 0.5 : slow ? 0.4 : 0.2);

  return (
    <LazyMotion features={domMax}>
      {/* 아이콘 시트는 **화면 전환 밖**에 선다 — `AnimatePresence` 안에 넣으면 전환마다 `<use>`가 가리킬
          대상이 사라졌다 다시 생긴다 */}
      <IconSheet />
      <audio ref={music} src={musicUrl} autoPlay={soundEnabled && !!musicUrl} loop preload="auto" />
      <div className="size-gate" role="status">1200×720 이상 화면에서 지원합니다.</div>
      {fusion && (
        <button className="fusion-scene" type="button" aria-label="융합 연출 건너뛰기" onClick={() => setFusion(undefined)}>
          {fusion.patrons.map((god) => (
            <figure key={god} style={{ "--god-color": `var(--${god})` } as CSSProperties}>
              <img className="fusion-god" src={godArt[`../../art/gods/${god}.webp`]} alt="" />
              <span className="fusion-particle"><img src={particleArt[`../art/particle/${particleStrip.attack[god]}.webp`]} alt="" /></span>
            </figure>
          ))}
          <div className="fusion-cards">
            <span className="fusion-before"><GameCard cardId={fusion.source.id} card={fusion.source} /></span>
            <span className="fusion-after"><GameCard cardId={fusion.result.id} card={fusion.result} /></span>
            <strong><Icon name="seal" /><Icon name="seal" /> 융합</strong>
          </div>
        </button>
      )}
      {/* 아이콘 시트와 같은 이유로 전환 밖이다 — 열 화면 어디에나 같은 자리에 서야 한다. 인트로만 예외:
          메뉴에 큰 것이 서므로 구석의 작은 것은 중복이다 */}
      {screen !== "intro" && screen !== "opening" && <FullscreenButton />}
      {/**
        * 전역 아이콘 셋(P-53) — 우상단 fixed, 셸 밖, zoom 미적용. 소리 토글은 시작 화면의
        * 버튼을 대체했다. 덱·약속 둘은 상태 바(P-54)로 이사했다 — 런 밖에는 덱도 약속도 없다
        */}
      {screen !== "opening" && (
        <nav className="global-icons" aria-label="전역 메뉴">
          <button type="button" onClick={() => setOverlay("cards")}>전체 카드</button>
          <button type="button" aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? "소리 켜짐" : "소리 꺼짐"}</button>
          <button type="button" onClick={() => setOverlay("tokens")}>사전</button>
          <button type="button" onClick={() => setOverlay("help")}>도움말</button>
        </nav>
      )}
      {/**
        * 상단 상태 바(P-54) — 여덟 런 화면의 값(체력·호의·위치·덱·약속)을 하나가 든다.
        * **화면 전환 밖**이다: 안에 넣으면 런당 ~36번 다시 서고 경계 펄스의 ref가 그때마다 리셋된다
        */}
      {pending && !opening && (
        <StatusBar
          view={pending.observation}
          turn={"turn" in pending.observation ? pending.observation.turn : undefined}
          block={"block" in pending.observation ? pending.observation.block : undefined}
          onOverlay={setOverlay}
          onRestart={() => setOverlay("restart")}
        />
      )}
      {/**
        * 런을 버리는 확인(P-65). `confirm()`을 안 쓴다 — 커서 넷·픽셀 서체·청동 틀이 전부 죽고
        * 게임 안에서 유일하게 OS가 말하는 자리가 된다. Esc·바깥 클릭·×는 셸이 이미 취소로 든다
        */}
      {overlay === "restart" && (
        <Overlay title="다시 시작" onClose={() => setOverlay(undefined)}>
          <p>진행 중인 런을 버립니다. 처음부터 시작할까요?</p>
          <div className="actions restart-actions">
            <button className="primary" type="button" onClick={() => { setOverlay(undefined); reset(); }}>다시 시작</button>
          </div>
        </Overlay>
      )}
      {/* 버튼은 짧은 「사전」, 제목은 범위를 드러내는 「게임 사전」이다. 내부 키는 기존 `tokens`를 그대로 쓴다 */}
      {overlay === "tokens" && (
        <Overlay title="게임 사전" onClose={() => setOverlay(undefined)}><TokenDictionary><CardSigns /></TokenDictionary></Overlay>
      )}
      {overlay === "help" && (
        <Overlay title="도움말" onClose={() => setOverlay(undefined)}><HelpPanel /></Overlay>
      )}
      {overlay === "cards" && (
        <Overlay wide title={`전체 카드 ${allCards.length}장`} onClose={() => setOverlay(undefined)}>
          <CardCatalog />
        </Overlay>
      )}
      {overlay === "deck" && pending && (
        <Overlay wide title={`덱 ${pending.observation.deck.length}장`} onClose={() => setOverlay(undefined)}>
          <DeckPanel deck={pending.observation.deck} />
        </Overlay>
      )}
      {overlay === "journal" && pending && (
        <Overlay title="과업" onClose={() => setOverlay(undefined)}>
          <JournalPanel
            active={"promises" in pending.observation ? pending.observation.promises : pending.observation.quest ? [pending.observation.quest] : []}
            history={journal}
          />
        </Overlay>
      )}
      <AnimatePresence mode="wait" initial={false} onExitComplete={() => { leavingCombatOutro.current = false; }}>
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
          {screen === "intro" && <IntroScreen onStart={() => { playSound("chips-handle-4", 0.45); setIntro(false); }} />}
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
              onStartAchievement={startAchievement}
              onStart={start}
            />
          )}
          {screen === "opening" && opening && <RunOpening patrons={opening} onDone={enterRun} />}
          {pending?.phase === "path" && (
            <MapScreen decision={pending} onChoosePath={answer} />
          )}
          {(pending?.phase === "card" || pending?.phase === "target") && (
            <CombatScreen seed={seed} decision={pending} outro={outro} onAnswer={answer} onOpenJournal={() => setOverlay("journal")} />
          )}
          {(pending?.phase === "rest" || pending?.phase === "rest_card") && (
            /* 직전 답이 곧 갈래다 — `rest_card`는 그 답 **바로 다음** 결정이고 `heal`은 여기를 안 지난다 */
            <RestScreen decision={pending} upgrading={actions.at(-1)?.choice === "upgrade"} onAnswer={answer} />
          )}
          {pending?.phase === "reward" && (
            <RewardScreen decision={pending} onAnswer={answer} />
          )}
          {(pending?.phase === "grace" || pending?.phase === "grace_card") && (
            <GraceScreen decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "demand" && (
            <DemandScreen decision={pending} onAnswer={answer} />
          )}
          {screen === "result" && result && (
            <ResultScreen seed={seed} patrons={patrons} deck={deck} split={split} actions={actions} result={result} onReset={reset} />
          )}
        </m.section>
      </AnimatePresence>
    </LazyMotion>
  );
}

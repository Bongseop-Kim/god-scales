// `domMax`는 `domAnimation` + drag + **layout**이다 — 적이 자리를 맞바꿀 때 미끄러지는 데 그 셋째가 필요하다
import { AnimatePresence, LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, RefObject } from "react";
import { bossLane, floorsPerRegion, laneCount, mapSlot, type MapGrid, type MapNodeType } from "../core/map.ts";
import type { GodId } from "../core/rules.ts";
import { deckSize, gods, ruleDeck, runSteps, startableCards, type Decision, type MapDecision, type PatronPair } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { Backdrop, backdropArt } from "./backdrop.tsx";
import { CardRow, GameCard } from "./card.tsx";
import { DemandScreen, GraceScreen, RestScreen } from "./choices.tsx";
import { CombatScreen } from "./combat.tsx";
import { godName, regionName, RunHeader } from "./header.tsx";
import { Icon, IconSheet } from "./icon.tsx";
import { RewardScreen } from "./reward.tsx";
import { downloadReplay } from "./export.ts";
import { playSound, sound } from "./sfx.ts";
import { TokenLegend } from "./tokens.tsx";
import "./motion.css";
import "./style.css";

type Steps = Generator<Decision, RunResult, string>;

/** 화면 전환 애니메이션의 key. 여기 없는 phase는 이름 그대로 자기 화면이다 */
const screens: Partial<Record<Decision["phase"], string>> = { path: "map", rest_card: "rest", card: "combat", target: "combat" };

const laneName = ["왼쪽", "가운데", "오른쪽"];
const nodeLabel: Record<MapNodeType, string> = { combat: "전투", elite: "정예", rest: "쉼터", omen: "예고", boss: "보스" };
const nodeDetail: Record<MapNodeType, string> = {
  combat: "보상을 노리고 위험을 감수합니다.",
  elite: "더 강한 편성입니다. 보상은 전투와 같습니다.",
  rest: "체력을 회복하거나 카드를 지웁니다.",
  omen: "신이 한 번 더 조건을 겁니다. 무엇인지는 들어가야 압니다.",
  boss: "지역의 끝입니다.",
};
const heroArt = import.meta.glob<string>("../art/hero/*.webp", { eager: true, query: "?url", import: "default" });
const hero = (name: "title" | "win" | "loss") => heroArt[`../art/hero/hero-${name}.webp`];

/**
 * 화면 전환. **런 하나에 약 36번 돈다** — `mode="wait"`가 퇴장이 끝난 뒤에 등장을 붙이므로 한 번의
 * 전환은 퇴장 + 등장이다. 방향은 축 하나다: 새 화면은 아래에서 올라오고 옛 화면은 위로 빠진다.
 * 전환 쌍마다 다른 연출을 만들지 않는다 — 화면이 하나 늘 때마다 칸이 여덟 개 늘기 때문이다
 */
const screenTransition = (duration: number) => ({ duration, ease: [0.23, 1, 0.32, 1] } as const);
/** 마커 이동. `motion`의 layout이 JS로 보간하므로 시간이 CSS에 없다 — `--ease-in-out`과 같은 곡선이다 */
const markerTransition = { duration: 0.24, ease: [0.77, 0, 0.175, 1] } as const;

/**
 * 조합은 집합이지 순서열이 아니다 — 고른 순서를 그대로 넘기면 시작 덱이 `[0]`에게 2·2·1, `[1]`에게
 * 3·1·1을 주므로(`sim/engine.ts`) 같은 조합이 두 게임이 된다. 엔진의 `gods` 순서로 굳혀 하나로 만든다
 */
export const patronPair = (picked: readonly GodId[]): PatronPair => gods.filter((god) => picked.includes(god)) as unknown as PatronPair;

/**
 * id → 그 카드의 신과 면. 시작 화면에는 관측이 없으므로 **값은 엔진이 내보낸 `startableCards`에서**
 * 온다 — UI가 `data/cards.json`을 따로 읽으면 같은 사실에 두 경로가 생긴다(`ui/card.tsx`와 같은 규칙)
 */
const cardIndex = new Map(gods.flatMap((god) => startableCards[god].map((card) => [card.id, { god, card }] as const)));

export function App() {
  const [seedInput, setSeedInput] = useState("1");
  const [seed, setSeed] = useState(1);
  const [picked, setPicked] = useState<GodId[]>(["zeus", "athena"]);
  /** 지금 돌고 있는 조합. `picked`와 나누는 이유는 `seed`를 `seedInput`과 나누는 이유와 같다 */
  const [patrons, setPatrons] = useState<PatronPair>(["zeus", "athena"]);
  /**
   * 사람이 짠 시작 덱. **`undefined`가 「손대지 않았다」다** — 그러면 엔진도 반출도 규칙 덱으로 간다.
   * `patrons`처럼 둘로 나누지 않는다: 편집기는 시작 화면에만 있고 런 중에는 그 화면이 없다
   */
  const [deck, setDeck] = useState<string[]>();
  const [actions, setActions] = useState<ReplayAction[]>([]);
  const [pending, setPending] = useState<Decision>();
  const [result, setResult] = useState<RunResult>();
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const seedField = useRef<HTMLInputElement>(null);
  const steps = useRef<Steps>(null);
  // 퇴장 애니메이션 중인 카드의 onClick은 옛 pending을 클로저에 들고 있다. 판정은 언제나 최신 결정으로 한다
  const latest = useRef<Decision>(null);
  const reducedMotion = useReducedMotion();
  const screen = result ? "result" : pending ? screens[pending.phase] ?? pending.phase : "setup";
  const pair = picked.length === 2 ? patronPair(picked) : undefined;
  /** 편집기가 그리는 열 장. 손대지 않았으면 규칙이 뽑은 것 그대로다 */
  const startingDeck = deck ?? (pair ? ruleDeck(pair) : []);

  const show = (decision?: Decision) => {
    latest.current = decision ?? null;
    setPending(decision);
  };

  const reset = () => {
    steps.current = null;
    show(undefined);
    setActions([]);
    setResult(undefined);
    setSeedInput(String(seed));
  };

  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 둘이 아니거나 열 장이 아니면 submit이 `disabled`다 — 그래도 여기 닿으면 엔진이 던진다
    if (!pair || startingDeck.length !== deckSize) return;
    const nextSeed = Number(seedInput);
    if (!Number.isInteger(nextSeed)) {
      seedField.current?.setCustomValidity("정수 시드를 입력하세요.");
      seedField.current?.reportValidity();
      return;
    }

    setSeed(nextSeed);
    setPatrons(pair);
    // `deck`을 그대로 넘긴다 — 손대지 않은 `undefined`가 곧 규칙 덱이다
    steps.current = runSteps(nextSeed, undefined, pair, deck);
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

  // 셋째를 누르면 가장 오래된 것이 빠진다 — 「먼저 해제하세요」를 만들지 않는다
  const toggleGod = (god: GodId) =>
    setPicked((now) => (now.includes(god) ? now.filter((id) => id !== god) : [...now, god].slice(-2)));

  const toggleSound = () => {
    const enabled = !soundEnabled;
    sound.enabled = enabled;
    setSoundEnabled(enabled);
  };

  // 시작·결과는 런당 한 번뿐이라 길어도 된다. 나머지 여섯 화면은 ~36번 도는 자리라 짧다
  const slow = screen === "setup" || screen === "result";
  const enter = reducedMotion ? { duration: 0 } : screenTransition(slow ? 0.32 : 0.16);
  const leave = reducedMotion ? { duration: 0 } : screenTransition(slow ? 0.32 : 0.12);

  return (
    <LazyMotion features={domMax}>
      {/* 아이콘 시트는 **화면 전환 밖**에 선다 — `AnimatePresence` 안에 넣으면 전환마다 `<use>`가 가리킬
          대상이 사라졌다 다시 생긴다 */}
      <IconSheet />
      {/* 아이콘 시트와 같은 이유로 전환 밖이다 — 열 화면 어디에나 같은 자리에 서야 한다 */}
      <FullscreenButton />
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
          {screen === "setup" && (
            <SetupScreen
              seedInput={seedInput}
              picked={picked}
              deck={startingDeck}
              soundEnabled={soundEnabled}
              seedField={seedField}
              onSeedChange={(value) => {
                seedField.current?.setCustomValidity("");
                setSeedInput(value);
              }}
              onToggleGod={toggleGod}
              onDeckChange={setDeck}
              onRestoreDeck={() => setDeck(undefined)}
              onStart={start}
              onToggleSound={toggleSound}
            />
          )}
          {pending?.phase === "path" && (
            <MapScreen seed={seed} decision={pending} onChoosePath={answer} />
          )}
          {(pending?.phase === "card" || pending?.phase === "target") && (
            <CombatScreen seed={seed} decision={pending} onAnswer={answer} />
          )}
          {(pending?.phase === "rest" || pending?.phase === "rest_card") && (
            <RestScreen seed={seed} decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "reward" && (
            <RewardScreen seed={seed} decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "grace" && (
            <GraceScreen seed={seed} decision={pending} onAnswer={answer} />
          )}
          {pending?.phase === "demand" && (
            <DemandScreen seed={seed} decision={pending} onAnswer={answer} />
          )}
          {screen === "result" && result && (
            <ResultScreen seed={seed} patrons={patrons} deck={deck} actions={actions} result={result} onReset={reset} />
          )}
        </m.section>
      </AnimatePresence>
    </LazyMotion>
  );
}

/**
 * 1040px 게임이 브라우저 탭·주소창·북마크바 아래에 앉아 있는 것을 지운다. **상태를 직접 들지 않는다** —
 * F11·Esc·창 전환으로 나가면 내 state와 화면이 어긋난다. 정본은 언제나 `document.fullscreenElement`고
 * `fullscreenchange`는 그래서 `document`에 건다(`element`에 걸면 나가는 순간을 놓친다).
 *
 * `requestFullscreen()`은 **클릭 핸들러 안에서만** 통한다 — 밖에서 부르면 조용히 거부된 Promise만
 * 남는다. 시작 화면에서 자동으로 켜는 것은 불가능하고, 시도해서도 안 된다
 */
function FullscreenButton() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // `type="button"` 필수 — 지금은 `<form className="shell setup">` 바깥이지만 `<button>`의 기본값은 submit이다
  return (
    <button type="button" className="fullscreen" onClick={() => (on ? document.exitFullscreen() : document.body.requestFullscreen())}>
      {on ? "창 모드" : "전체화면"}
    </button>
  );
}

/**
 * 시작 덱 편집기. **접혀 있는 것이 기본이라** 시작 화면 높이는 그대로다 — 상태는 `<details>`가 든다.
 * 규칙이 뽑은 열 장이 미리 차 있어 손대지 않으면 고정 모드와 같은 런이다: 빈 열 칸에서 시작하면
 * 124장을 훑어야 한다. 슬롯을 누르면 빠지고 목록을 누르면 들어간다.
 *
 * **중복도 상한도 두지 않는다** — 지금 규칙 덱부터가 같은 카드 2·3장이고, 같은 카드 열 장은 나쁜
 * 덱이지 막을 것이 아니다. 열한째는 조합 선택과 같은 꼴로 가장 오래된 것을 밀어낸다: 「먼저 빼세요」를
 * 만들지 않는다. 카드는 `CardRow`/`GameCard` 그대로다 — 보상 화면과 같은 그림이라 새 컴포넌트가 없다
 */
function DeckEditor({ deck, picked, onChange, onRestore }: {
  deck: string[];
  picked: GodId[];
  onChange: (deck: string[]) => void;
  /**
   * 「손대지 않았다」로 되돌린다. **되돌릴 길이 없으면 편집기는 한 방향 문이다** — 조합을 둘에서
   * 하나로 줄이면 슬롯이 비고(규칙 덱을 못 뽑는다) 거기서 한 장을 넣으면 아홉 장이 모자란 채 갇힌다.
   * 규칙 덱을 그대로 채워 넣지 않는 이유는 반출이다: `undefined`라야 이 런이 고정 모드로 남는다
   */
  onRestore: () => void;
}) {
  const [tab, setTab] = useState<GodId>(gods[0]);
  const list = startableCards[tab];
  return (
    <details className="deck-editor">
      <summary>시작 덱 {deck.length} / {deckSize}장 — 손대지 않으면 규칙이 뽑은 열 장입니다</summary>
      {/*
        §3의 저울은 **이미 코드에 있다**(`core/favor.ts`) — 지금까지 어디에도 안 적혀 있었을 뿐이다.
        조합 밖 신의 카드는 그 신의 호의만 올리고, 은혜·개입·합성은 전부 `patrons`만 읽는다
      */}
      <p className="hint">
        조합 밖 신의 카드도 넣을 수 있습니다. 다만 그 신의 호의는 아무것도 움직이지 않고, 조우마다
        후원 신 호의가 −3씩(그 조우에 한 장도 안 쓴 신은 −2 더) 빠집니다 — 은혜와 융합이 그만큼 멀어집니다.
      </p>
      <div className="deck-slots">
        {deck.map((id, index) => {
          const held = cardIndex.get(id)!;
          const alien = !picked.includes(held.god);
          return (
            <span className={alien ? "slot alien" : "slot"} key={`${id}-${index}`}>
              <GameCard cardId={id} card={held.card} onSelect={() => onChange(deck.filter((_, at) => at !== index))} />
              {/* 색이 아니라 글자다 — 색만으로는 흑백에서 규칙이 사라진다(R-26의 채널 규칙) */}
              {alien && <em>호의 안 오름</em>}
            </span>
          );
        })}
      </div>
      <button type="button" onClick={onRestore}>규칙 덱으로</button>
      {/* 124장을 한 화면에 깔지 않는다 — 조합 선택과 같은 버튼 줄이 신 다섯으로 거른다 */}
      <div className="god-legend" role="group" aria-label="신별 카드">
        {gods.map((god) => (
          <button
            key={god}
            type="button"
            aria-pressed={tab === god}
            style={{ "--god-color": `var(--${god})` } as CSSProperties}
            onClick={() => setTab(god)}
          >
            <i />
            {godName(god)}
          </button>
        ))}
      </div>
      <CardRow
        cards={list}
        options={list.map(({ id }) => id)}
        onSelect={(id) => onChange([...deck, id].slice(-deckSize))}
      />
    </details>
  );
}

interface SetupScreenProps {
  seedInput: string;
  picked: GodId[];
  deck: string[];
  soundEnabled: boolean;
  seedField: RefObject<HTMLInputElement | null>;
  onSeedChange: (value: string) => void;
  onToggleGod: (god: GodId) => void;
  onDeckChange: (deck: string[]) => void;
  onRestoreDeck: () => void;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onToggleSound: () => void;
}

function SetupScreen({
  seedInput,
  picked,
  deck,
  soundEnabled,
  seedField,
  onSeedChange,
  onToggleGod,
  onDeckChange,
  onRestoreDeck,
  onStart,
  onToggleSound,
}: SetupScreenProps) {
  return (
    <>
      <Backdrop src={hero("title")} tone="hero" />
      <form className="shell setup" onSubmit={onStart}>
      <p className="eyebrow">결정론적 덱빌딩 프로토타입</p>
      <h1>신들의 저울</h1>
      <p className="lead">두 신의 호의를 관리하며 지하에서 지상까지 12층을 돌파하세요.</p>
      {/*
        이름은 `data/gods.json`, 색은 `--{id}` CSS 변수다 — 둘 다 화면에 다시 적지 않는다.
        순서도 **엔진의 `gods`**에서 온다: 데이터 순서로 그리고 코드 순서로 넘기면 둘이 갈리는 날
        조용히 다른 런이 된다. 한 배열만 쓰면 갈릴 자리가 없다
      */}
      <p className="pick-label" id="patron-pick">후원할 신 둘</p>
      <div className="god-legend" role="group" aria-labelledby="patron-pick">
        {gods.map((god) => (
          <button
            key={god}
            type="button"
            aria-pressed={picked.includes(god)}
            style={{ "--god-color": `var(--${god})` } as CSSProperties}
            onClick={() => onToggleGod(god)}
          >
            <i />
            {godName(god)}
          </button>
        ))}
      </div>
      <div className="token-legend" aria-label="상태 토큰">
        <TokenLegend />
      </div>
      <DeckEditor deck={deck} picked={picked} onChange={onDeckChange} onRestore={onRestoreDeck} />
      <label className="seed-field">
        런 시드
        <input
          ref={seedField}
          type="number"
          value={seedInput}
          step="1"
          required
          onChange={(event) => onSeedChange(event.target.value)}
        />
      </label>
      <div>
        <button className="primary" type="submit" disabled={picked.length !== 2 || deck.length !== deckSize}>런 시작</button>
        <button className="sound-toggle" type="button" aria-pressed={soundEnabled} onClick={onToggleSound}>
          {soundEnabled ? "소리 켜짐" : "소리 꺼짐"}
        </button>
      </div>
      <p className="hint">갈림길·카드·대상·보상·휴식·은혜·요구를 전부 당신이 고릅니다. 룰 봇이 대신 정하는 것은 없습니다.</p>
      </form>
    </>
  );
}

export function MapScreen({ seed, decision, onChoosePath }: {
  seed: number;
  decision: MapDecision;
  onChoosePath: (choice: string) => void;
}) {
  const view = decision.observation;
  return (
    // 격자가 유일한 조작 면이다 — 패널이 하나뿐이라 `run-layout`(2열)을 쓰면 오른쪽 칸이 통째로 빈다
    <>
      <Backdrop src={backdropArt(view.region, "map")} />
      <div className="shell">
        <RunHeader seed={seed} view={view} title="경로 선택" badge={`${view.depth + 1} / 12층`} />
        {/* 지금 서 있는 칸은 **직전 층의** 걸어온 갈래다 — `view.depth`는 지금 고르는 층이다 */}
        <MapPanel
          grid={view.grid}
          region={view.region}
          here={{ depth: view.depth - 1, lane: view.lane }}
          open={{ depth: view.depth, options: decision.options }}
          text={view.text}
          onEnter={onChoosePath}
        />
      </div>
    </>
  );
}

/**
 * 지역 여섯 층 × 세 갈래를 한눈에 깐다 — 슬레이 더 스파이어 방식이다. 그래야 「3층에서 왼쪽으로
 * 가면 정예를 밟지만 5층 쉼터에 닿는다」가 성립한다. 지나온 지역은 결과 화면에서 둘 다 보인다.
 *
 * `onEnter`가 오면 **격자가 곧 조작 면이다** — 칸이 `<button>`이 되고 누르면 마커가 그 칸으로 걸어간
 * 다음에 화면이 넘어간다. 결과 화면은 그것을 안 주므로 같은 격자가 읽는 그림으로 남는다
 */
export function MapPanel({ grid, region, open, here, taken = [], text, onEnter }: {
  grid: MapGrid;
  region: string;
  /** 지금 고를 수 있는 갈래. `"lane:type"` 그대로 든다 — 격자에서 되만들면 두 번째 진실이 생긴다 */
  open?: { depth: number; options: string[] };
  /** 병사가 **지금 서 있는** 칸 하나. 마커가 여기에만 선다 — 걸어온 길 전부는 `taken`이 든다 */
  here?: { depth: number; lane: number };
  /** `depth` → 지나온 갈래. 결과 화면이 걸어온 길을 여기로 표시한다 */
  taken?: (number | undefined)[];
  /** 아무 칸도 안 가리킬 때 설명 줄이 드는 문장 — 그 층의 문구다 */
  text?: string;
  /** 열린 칸을 누를 수 있게 한다. 없으면 격자는 읽는 그림이다(결과 화면) */
  onEnter?: (option: string) => void;
}) {
  const base = region === "surface" ? floorsPerRegion : 0;
  /** 가리킨 칸의 종류. **hover와 focus 둘 다** 여기 들어온다 — hover만 보면 키보드·터치에서 설명이 사라진다 */
  const [pointed, setPointed] = useState<MapNodeType>();
  /** 걸어가는 중인 갈래(`"lane:type"`). 서면 전 칸이 잠기고 마커가 그 칸으로 간다 */
  const [moving, setMoving] = useState<string>();
  const reducedMotion = useReducedMotion();
  const at = moving && open ? { depth: open.depth, lane: Number(moving.split(":")[0]) } : here;
  const standing = (depth: number, lane: number) => at?.depth === depth && at.lane === lane;
  /**
   * 시작 칸. **`here.depth`가 이 지역 밖일 때만** 선다 — 저승 1층은 −1이고 지상 1층은 직전이 저승
   * 보스(5)라 둘 다 이 격자에 자리가 없다. 「`depth === 0`」으로 적으면 지상 1층이 다시 빈다
   */
  const start = here && (here.depth < base || here.depth >= base + floorsPerRegion) ? here : undefined;
  /**
   * 마커는 **하나**다. `moving`이 그것을 다른 칸의 자식으로 옮기기만 하고 두 위치 사이는 `motion`의
   * layout이 잇는다 — 좌표도 keyframes도 없다. 끝나는 신호도 거기서 오므로 시간이 한 곳에만 적힌다
   */
  const marker = (
    <m.span
      className="marker"
      layoutId="run-marker"
      transition={reducedMotion ? { duration: 0 } : markerTransition}
      onLayoutAnimationComplete={() => moving && onEnter?.(moving)}
    />
  );
  return (
    <div className={`map-panel${onEnter ? " walkable" : ""}`}>
      <h2>{regionName(region)} 6층 × 3갈래</h2>
      <ol>
        {/* 위에서 아래로 6층 → 1층. 오르는 방향과 화면 방향이 같다 */}
        {Array.from({ length: floorsPerRegion }, (_, index) => {
          const depth = base + floorsPerRegion - 1 - index;
          const row = grid[depth] ?? [];
          return (
            <li key={depth}>
              <small>{mapSlot(depth).floor}층</small>
              {Array.from({ length: laneCount }, (_, lane) => {
                const type = row[lane];
                const option = open?.depth === depth ? open.options.find((choice) => choice.startsWith(`${lane}:`)) : undefined;
                const className = `map-node${type ? ` ${type}` : " empty"}${taken[depth] === lane ? " current" : ""}${standing(depth, lane) ? " here" : ""}${option ? " open" : ""}`;
                // 읽는 그림에서는 칸이 16px 아이콘 하나다 — 이름은 `title`이 든다. `omen`도 「예고」까지는
                // 말한다: 감추는 것은 종류가 아니라 그 안의 내용이다
                if (!onEnter || !type) {
                  return (
                    <i className={className} key={lane} title={type ? nodeLabel[type] : undefined}>
                      {type ? <Icon name={type} /> : ""}
                      {standing(depth, lane) && marker}
                    </i>
                  );
                }
                return (
                  <button
                    className={className}
                    key={lane}
                    type="button"
                    // 이동이 시작되면 **전 칸이** 잠긴다 — 두 번 눌러 같은 결정이 둘 나가는 것을 막는다
                    disabled={!option || moving !== undefined}
                    // 격자에서는 위치가 곧 갈래다. 스크린리더에는 격자가 없으므로 갈래 이름이 여기 남는다
                    aria-label={`${laneName[lane]} · ${nodeLabel[type]} · ${nodeDetail[type]}`}
                    onClick={() => (reducedMotion ? onEnter(option!) : setMoving(option))}
                    onPointerEnter={() => setPointed(type)}
                    onPointerLeave={() => setPointed(undefined)}
                    onFocus={() => setPointed(type)}
                    onBlur={() => setPointed(undefined)}
                  >
                    <Icon name={type} />
                    <b>{nodeLabel[type]}</b>
                    {standing(depth, lane) && marker}
                  </button>
                );
              })}
            </li>
          );
        })}
        {start && (
          <li className="start">
            {/* 지상 1층의 그 자리는 방금 지나온 저승 보스다 — 보스도 런 시작 `lane`도 `bossLane`이라 칸 위치가 같다 */}
            <small>{start.depth < 0 ? "시작" : `${regionName(mapSlot(start.depth).region)}에서`}</small>
            {Array.from({ length: laneCount }, (_, lane) => (
              <i className={`map-node${lane === bossLane ? "" : " empty"}${standing(start.depth, lane) ? " here" : ""}`} key={lane}>
                {standing(start.depth, lane) && marker}
              </i>
            ))}
          </li>
        )}
      </ol>
      {/* 가리킨 칸의 설명 한 줄. 아무것도 안 가리키면 그 층의 문구가 이 자리를 든다 */}
      {text && <p className="node-hint">{pointed ? `${nodeLabel[pointed]} — ${nodeDetail[pointed]}` : text}</p>}
    </div>
  );
}

/**
 * `pathChoices`는 보스 층을 빼고 순서대로 쌓인다 — 보스는 물을 것이 없어 기록이 없다.
 * 그래서 깊이를 훑으며 하나씩 꺼내고 보스 층은 `bossLane`으로 채운다
 */
function takenLanes(grid: MapGrid, pathChoices: string[], reached: number): (number | undefined)[] {
  const remaining = [...pathChoices];
  return Array.from({ length: grid.length }, (_, depth) => {
    const lane = mapSlot(depth).floor === floorsPerRegion ? bossLane : Number(remaining.shift()?.split(":")[0]);
    return depth < reached && Number.isInteger(lane) ? lane : undefined;
  });
}

function ResultScreen({ seed, patrons, deck, actions, result, onReset }: {
  seed: number;
  patrons: PatronPair;
  /** 이 런이 짜서 들고 간 덱. 규칙 덱이면 `undefined`이고 반출에도 안 적힌다 */
  deck?: string[];
  actions: ReplayAction[];
  result: RunResult;
  onReset: () => void;
}) {
  const finalFavor = result.favorCurve.at(-1) ?? {};
  const reached = Math.min(12, result.hpCurve.length - 1);
  const recentCards = [...new Set(result.cardsPlayed)].slice(0, 3);
  return (
    <>
      <Backdrop src={hero(result.won ? "win" : "loss")} tone="hero" />
      <div className="shell result-layout">
      <header>
        {/* 시드 하나로는 런을 못 특정한다 — 조합이 같이 서야 이 결과를 다시 만들 수 있다 */}
        <div><p className="eyebrow">시드 {seed} · {patrons.map(godName).join(" + ")} · {reached}/12층</p><h1>{result.won ? "승리" : "패배"}</h1></div>
        <span className={`outcome ${result.won ? "win" : "loss"}`}>{result.won ? "균형 유지" : "저울 붕괴"}</span>
      </header>
      <div className="summary-grid">
        <Summary label="최종 체력" value={result.hpCurve.at(-1) ?? 0} />
        <Summary label="전투 횟수" value={result.encounters} />
        {/* 신 이름을 상수로 박으면 다른 조합을 돌릴 때 빈칸이 된다 */}
        {patrons.map((god) => (
          <Summary key={god} label={`${godName(god)} 호의`} value={finalFavor[god] ?? 0} />
        ))}
      </div>
      <div className="result-columns">
        <div className="map-columns">
          {["underworld", "surface"].map((region) => (
            <MapPanel key={region} grid={result.grid} region={region} taken={takenLanes(result.grid, result.pathChoices, reached)} />
          ))}
        </div>
        <div className="combat-log">
          <h2>전투 기록</h2>
          <div className="used-cards">
            {recentCards.map((cardId) => <GameCard key={cardId} cardId={cardId} />)}
          </div>
          <ol>{result.log.slice(-10).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
        </div>
      </div>
      <div className="actions">
        <button className="primary" type="button" onClick={() => downloadReplay(seed, actions, patrons, deck)}>런 JSON 반출</button>
        <button type="button" onClick={onReset}>다시 시작</button>
      </div>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article><small>{label}</small><strong>{value}</strong></article>;
}

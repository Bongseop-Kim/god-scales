import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type { CSSProperties, FormEvent, RefObject } from "react";
import { bossLane, floorsPerRegion, laneCount, mapSlot, type MapGrid, type MapNodeType } from "../core/map.ts";
import { runSteps, type Decision, type MapDecision } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { Backdrop, backdropArt } from "./backdrop.tsx";
import { GameCard } from "./card.tsx";
import { DemandScreen, GraceScreen, RestScreen } from "./choices.tsx";
import { CombatScreen } from "./combat.tsx";
import { godIds, godName, regionName, RunHeader } from "./header.tsx";
import { RewardScreen } from "./reward.tsx";
import { downloadReplay } from "./export.ts";
import { playSound, sound } from "./sfx.ts";
import { TokenLegend } from "./tokens.tsx";
import "./motion.css";
import "./style.css";

type Steps = Generator<Decision, RunResult, string>;

/** 화면 전환 애니메이션의 key. 여기 없는 phase는 이름 그대로 자기 화면이다 */
const screens: Partial<Record<Decision["phase"], string>> = { path: "map", rest_card: "rest", card: "combat", target: "combat" };

/**
 * 칸 표시. `omen`만 종류를 감춘다(`?`) — 다키스트 던전 2의 물음표 자리다. 색·간격은 P-26이 가져간다
 */
const nodeMark: Record<MapNodeType, string> = { combat: "전", elite: "정", rest: "휴", omen: "?", boss: "보" };
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

const screenTransition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] } as const;

export function App() {
  const [seedInput, setSeedInput] = useState("1");
  const [seed, setSeed] = useState(1);
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
    const nextSeed = Number(seedInput);
    if (!Number.isInteger(nextSeed)) {
      seedField.current?.setCustomValidity("정수 시드를 입력하세요.");
      seedField.current?.reportValidity();
      return;
    }

    setSeed(nextSeed);
    steps.current = runSteps(nextSeed);
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

  const toggleSound = () => {
    const enabled = !soundEnabled;
    sound.enabled = enabled;
    setSoundEnabled(enabled);
  };

  const transition = reducedMotion ? { duration: 0 } : screenTransition;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait" initial={false}>
        {/**
         * E2E(`npm run e2e`)가 읽는 두 값이다. `data-phase`는 지금 무엇을 묻는지, `data-step`은 답한
         * 결정의 수 — 클릭이 실제로 엔진을 한 칸 움직였는지 이것 하나로 안다. 화면 텍스트를 긁는 것보다 짧다
         */}
        <m.section
          key={screen}
          data-phase={pending?.phase ?? screen}
          data-step={actions.length}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          {screen === "setup" && (
            <SetupScreen
              seedInput={seedInput}
              soundEnabled={soundEnabled}
              seedField={seedField}
              onSeedChange={(value) => {
                seedField.current?.setCustomValidity("");
                setSeedInput(value);
              }}
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
            <ResultScreen seed={seed} actions={actions} result={result} onReset={reset} />
          )}
        </m.section>
      </AnimatePresence>
    </LazyMotion>
  );
}

interface SetupScreenProps {
  seedInput: string;
  soundEnabled: boolean;
  seedField: RefObject<HTMLInputElement | null>;
  onSeedChange: (value: string) => void;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onToggleSound: () => void;
}

function SetupScreen({
  seedInput,
  soundEnabled,
  seedField,
  onSeedChange,
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
      {/* 이름은 `data/gods.json`, 색은 `--{id}` CSS 변수다 — 둘 다 화면에 다시 적지 않는다 */}
      <div className="god-legend">
        {godIds.map((god) => (
          <span key={god}>
            <i style={{ "--god-color": `var(--${god})` } as CSSProperties} />
            {godName(god)}
          </span>
        ))}
      </div>
      <div className="token-legend" aria-label="상태 토큰">
        <TokenLegend />
      </div>
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
        <button className="primary" type="submit">런 시작</button>
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
    <>
      <Backdrop src={backdropArt(view.region, "map")} />
      <div className="shell run-layout">
      <RunHeader seed={seed} view={view} title="경로 선택" badge={`${view.depth + 1} / 12층`} />
      {/* 지금 서 있는 칸은 **직전 층의** 걸어온 갈래다 — `view.depth`는 지금 고르는 층이다 */}
      <MapPanel
        grid={view.grid}
        region={view.region}
        here={{ depth: view.depth - 1, lane: view.lane }}
        open={{ depth: view.depth, lanes: decision.options.map((option) => Number(option.split(":")[0])) }}
      />
      <div className="decision-panel">
        <h2>어디로 향할까요?</h2>
        <p className="hint">{view.text}</p>
        {decision.options.map((option) => {
          const [lane, type] = option.split(":") as [string, MapNodeType];
          return (
            <button className={`choice ${type}`} type="button" key={option} onClick={() => onChoosePath(option)}>
              <span>{nodeMark[type]}</span>
              {/* 같은 종류가 두 갈래에 있으면 이름만으로는 못 가른다 — 갈래를 라벨에 적는다 */}
              <b>{laneName[Number(lane)]} · {nodeLabel[type]}</b>
              <small>{nodeDetail[type]}</small>
            </button>
          );
        })}
      </div>
      </div>
    </>
  );
}

/**
 * 지역 여섯 층 × 세 갈래를 한눈에 깐다 — 슬레이 더 스파이어 방식이다. 그래야 「3층에서 왼쪽으로
 * 가면 정예를 밟지만 5층 쉼터에 닿는다」가 성립한다. 지나온 지역은 결과 화면에서 둘 다 보인다
 */
function MapPanel({ grid, region, open, here, taken = [] }: {
  grid: MapGrid;
  region: string;
  /** 지금 고를 수 있는 갈래 — 경로 화면에서만 온다 */
  open?: { depth: number; lanes: number[] };
  /** 병사가 **지금 서 있는** 칸 하나. 마커가 여기에만 선다 — 걸어온 길 전부는 `taken`이 든다 */
  here?: { depth: number; lane: number };
  /** `depth` → 지나온 갈래. 결과 화면이 걸어온 길을 여기로 표시한다 */
  taken?: (number | undefined)[];
}) {
  const base = region === "surface" ? floorsPerRegion : 0;
  return (
    <div className="map-panel">
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
                const walked = taken[depth] === lane;
                const openHere = open?.depth === depth && open.lanes.includes(lane);
                const standing = here?.depth === depth && here.lane === lane;
                return (
                  <i className={`map-node${type ? ` ${type}` : " empty"}${walked ? " current" : ""}${standing ? " here" : ""}${openHere ? " open" : ""}`} key={lane}>
                    {type ? nodeMark[type] : ""}
                  </i>
                );
              })}
            </li>
          );
        })}
      </ol>
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

function ResultScreen({ seed, actions, result, onReset }: {
  seed: number;
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
        <div><p className="eyebrow">시드 {seed} · {reached}/12층</p><h1>{result.won ? "승리" : "패배"}</h1></div>
        <span className={`outcome ${result.won ? "win" : "loss"}`}>{result.won ? "균형 유지" : "저울 붕괴"}</span>
      </header>
      <div className="summary-grid">
        <Summary label="최종 체력" value={result.hpCurve.at(-1) ?? 0} />
        <Summary label="전투 횟수" value={result.encounters} />
        {/* 조합은 결과에 적혀 온다 — 신 이름을 상수로 박으면 다른 조합을 돌릴 때 빈칸이 된다 */}
        {(result.pairing?.split("+") ?? []).map((god) => (
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
        <button className="primary" type="button" onClick={() => downloadReplay(seed, actions)}>런 JSON 반출</button>
        <button type="button" onClick={onReset}>다시 시작</button>
      </div>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article><small>{label}</small><strong>{value}</strong></article>;
}

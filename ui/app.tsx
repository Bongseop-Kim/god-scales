import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type { CSSProperties, FormEvent, RefObject } from "react";
import { mapNode } from "../core/map.ts";
import { run } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { GameCard } from "./card.tsx";
import { downloadReplay } from "./export.ts";
import { playSound, sound } from "./sfx.ts";
import { TokenLegend } from "./tokens.tsx";
import "./motion.css";
import "./style.css";

type Screen = "setup" | "map" | "result";
type PathChoice = "combat" | "rest";

const choiceFloors = ["지하 3층", "지하 5층", "지상 3층", "지상 5층"];
const godColors = [
  ["제우스", "#f2c94c"],
  ["포세이돈", "#43b9d6"],
  ["아테나", "#a8b0c3"],
  ["아레스", "#e45b4f"],
  ["아르테미스", "#75c66a"],
] as const;

const screenTransition = { duration: 0.18, ease: [0.23, 1, 0.32, 1] } as const;

export function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [seedInput, setSeedInput] = useState("1");
  const [seed, setSeed] = useState(1);
  const [actions, setActions] = useState<ReplayAction[]>([]);
  const [result, setResult] = useState<RunResult>();
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const seedField = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  const reset = () => {
    setScreen("setup");
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
    setScreen("map");
    playSound("start");
  };

  const choosePath = (choice: PathChoice) => {
    const nextActions: ReplayAction[] = [...actions, { type: "path", choice }];
    setActions(nextActions);
    if (nextActions.length === choiceFloors.length) {
      setResult(run(seed, undefined, nextActions));
      setScreen("result");
    }
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
        <m.section
          key={screen}
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
          {screen === "map" && <MapScreen seed={seed} actions={actions} onChoosePath={choosePath} />}
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
    <form className="shell setup" onSubmit={onStart}>
      <p className="eyebrow">결정론적 덱빌딩 프로토타입</p>
      <h1>신들의 저울</h1>
      <p className="lead">제우스와 아테나의 호의를 관리하며 지하에서 지상까지 12층을 돌파하세요.</p>
      <div className="god-legend">
        {godColors.map(([name, color]) => (
          <span key={name}>
            <i style={{ "--god-color": color } as CSSProperties} />
            {name}
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
      <p className="hint">전투는 룰 봇이 자동 진행합니다. 당신은 네 번의 갈림길을 결정합니다.</p>
    </form>
  );
}

function MapScreen({ seed, actions, onChoosePath }: {
  seed: number;
  actions: ReplayAction[];
  onChoosePath: (choice: PathChoice) => void;
}) {
  const label = choiceFloors[actions.length];
  return (
    <div className="shell run-layout">
      <header>
        <div><p className="eyebrow">시드 {seed} · 제우스 + 아테나</p><h1>경로 선택</h1></div>
        <strong>{actions.length + 1} / {choiceFloors.length}</strong>
      </header>
      <MapPanel actions={actions} />
      <div className="decision-panel">
        <p className="eyebrow">{label}</p>
        <h2>어디로 향할까요?</h2>
        <PathButton choice="combat" onChoose={onChoosePath} />
        <PathButton choice="rest" onChoose={onChoosePath} />
      </div>
    </div>
  );
}

function PathButton({ choice, onChoose }: { choice: PathChoice; onChoose: (choice: PathChoice) => void }) {
  const combat = choice === "combat";
  return (
    <button className={`choice ${choice}`} type="button" onClick={() => onChoose(choice)}>
      <span>{combat ? "전" : "휴"}</span>
      <b>{combat ? "전투" : "휴식"}</b>
      <small>{combat ? "보상을 노리고 위험을 감수합니다." : "체력을 회복해 다음 전투를 준비합니다."}</small>
    </button>
  );
}

function MapPanel({ actions }: { actions: ReplayAction[] }) {
  return (
    <div className="map-panel">
      <h2>12층 지도</h2>
      <ol>
        {Array.from({ length: 12 }, (_, index) => {
          const node = mapNode(index);
          const optionalIndex = [2, 4, 8, 10].indexOf(index);
          const chosen = optionalIndex >= 0 ? actions[optionalIndex]?.choice : undefined;
          const symbol = node.options[0] === "boss" ? "보" : chosen === "rest" ? "휴" : "전";
          const region = node.region === "underworld" ? "지하" : "지상";
          return (
            <li className={`map-node${chosen ? ` ${chosen}` : ""}`} key={index}>
              <span>{symbol}</span>{region} {node.floor}층
            </li>
          );
        })}
      </ol>
    </div>
  );
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
    <div className="shell result-layout">
      <header>
        <div><p className="eyebrow">시드 {seed} · {reached}/12층</p><h1>{result.won ? "승리" : "패배"}</h1></div>
        <span className={`outcome ${result.won ? "win" : "loss"}`}>{result.won ? "균형 유지" : "저울 붕괴"}</span>
      </header>
      <div className="summary-grid">
        <Summary label="최종 체력" value={result.hpCurve.at(-1) ?? 0} />
        <Summary label="전투 횟수" value={result.encounters} />
        <Summary label="제우스 호의" value={finalFavor.zeus ?? 0} />
        <Summary label="아테나 호의" value={finalFavor.athena ?? 0} />
      </div>
      <div className="result-columns">
        <MapPanel actions={actions} />
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
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article><small>{label}</small><strong>{value}</strong></article>;
}

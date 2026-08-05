import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type { CSSProperties, FormEvent, RefObject } from "react";
import { mapNode } from "../core/map.ts";
import { runSteps, type Decision, type MapDecision } from "../sim/engine.ts";
import type { ReplayAction } from "../sim/replay.ts";
import type { RunResult } from "../sim/report.ts";
import { GameCard } from "./card.tsx";
import { DemandScreen, GraceScreen, RestScreen } from "./choices.tsx";
import { CombatScreen } from "./combat.tsx";
import { godName, regionName, RunHeader } from "./header.tsx";
import { RewardScreen } from "./reward.tsx";
import { downloadReplay } from "./export.ts";
import { playSound, sound } from "./sfx.ts";
import { TokenLegend } from "./tokens.tsx";
import "./motion.css";
import "./style.css";

type PathChoice = "combat" | "rest";
type Steps = Generator<Decision, RunResult, string>;

/** 화면 전환 애니메이션의 key. 여기 없는 phase는 이름 그대로 자기 화면이다 */
const screens: Partial<Record<Decision["phase"], string>> = { path: "map", rest_card: "rest", card: "combat", target: "combat" };

/** 갈림길이 열리는 노드. MapPanel의 칸 표시와 "n / 4" 카운터가 같은 목록을 읽는다 */
const choiceNodes = [2, 4, 8, 10];
const godColors = [
  ["제우스", "#f2c94c"],
  ["포세이돈", "#43b9d6"],
  ["아테나", "#a8b0c3"],
  ["아레스", "#e45b4f"],
  ["아르테미스", "#75c66a"],
] as const;

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
            <MapScreen seed={seed} decision={pending} actions={actions} onChoosePath={answer} />
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
    <form className="shell setup" onSubmit={onStart}>
      <p className="eyebrow">결정론적 덱빌딩 프로토타입</p>
      <h1>신들의 저울</h1>
      <p className="lead">두 신의 호의를 관리하며 지하에서 지상까지 12층을 돌파하세요.</p>
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
      <p className="hint">갈림길·카드·대상·보상·휴식·은총·요구를 전부 당신이 고릅니다. 룰 봇이 대신 정하는 것은 없습니다.</p>
    </form>
  );
}

export function MapScreen({ seed, decision, actions, onChoosePath }: {
  seed: number;
  decision: MapDecision;
  actions: ReplayAction[];
  onChoosePath: (choice: PathChoice) => void;
}) {
  const view = decision.observation;
  return (
    <div className="shell run-layout">
      <RunHeader seed={seed} view={view} title="경로 선택" badge={`${choiceNodes.indexOf(view.node) + 1} / ${choiceNodes.length}`} />
      <MapPanel choices={pathChoices(actions)} current={view.node} />
      <div className="decision-panel">
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

const pathChoices = (actions: ReplayAction[]) => actions.filter(({ type }) => type === "path").map(({ choice }) => choice);

function MapPanel({ choices, current }: { choices: string[]; current?: number }) {
  return (
    <div className="map-panel">
      <h2>12층 지도</h2>
      <ol>
        {Array.from({ length: 12 }, (_, index) => {
          const node = mapNode(index);
          const optionalIndex = choiceNodes.indexOf(index);
          const chosen = optionalIndex >= 0 ? choices[optionalIndex] : undefined;
          const symbol = node.options[0] === "boss" ? "보" : chosen === "rest" ? "휴" : "전";
          return (
            <li className={`map-node${chosen ? ` ${chosen}` : ""}${index === current ? " current" : ""}`} key={index}>
              <span>{symbol}</span>{regionName(node.region)} {node.floor}층
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
        {/* 조합은 결과에 적혀 온다 — 신 이름을 상수로 박으면 다른 조합을 돌릴 때 빈칸이 된다 */}
        {(result.pairing?.split("+") ?? []).map((god) => (
          <Summary key={god} label={`${godName(god)} 호의`} value={finalFavor[god] ?? 0} />
        ))}
      </div>
      <div className="result-columns">
        <MapPanel choices={result.pathChoices} />
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

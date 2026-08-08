import type { PatronPair } from "../../sim/engine.ts";
import type { ReplayAction } from "../../sim/replay.ts";
import type { RunResult } from "../../sim/report.ts";
import { Backdrop, hero, Prop } from "../shared/backdrop.tsx";
import { GameCard } from "../shared/card.tsx";
import { downloadReplay } from "../shared/export.ts";
import { godName } from "../shared/header.tsx";
import { MapPanel, takenLanes } from "./map.tsx";

export function ResultScreen({ seed, patrons, deck, split, actions, result, onReset }: {
  seed: number;
  patrons: PatronPair;
  /** 이 런이 짜서 들고 간 덱. 규칙 덱이면 `undefined`이고 반출에도 안 적힌다 */
  deck?: string[];
  /** 이 런이 시작한 배분. 50이면 반출에 안 적힌다 — 옛 replay와 같은 파일이 된다 */
  split: number;
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
      {/* 결과 프롭 셋(P-58 §12) — 승리는 독수리·리본·빛기둥, 패배는 재·사슬·도깨비불 */}
      {(result.won ? ["surface_eagle", "surface_ribbon", "surface_light_shaft"] : ["under_ash", "under_chain", "under_wisp"])
        .map((name, index) => <Prop key={name} name={name} className={`outcome-prop o${index}`} />)}
      <header>
        {/* 「시드 N」은 개발자 표기다(P-54) — 시드는 반출 JSON에 남는 것이 맞고 화면에는 안 선다 */}
        <div><p className="eyebrow">{patrons.map(godName).join(" + ")} · {reached}/12층</p><h1>{result.won ? "승리" : "패배"}</h1></div>
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
          {/* 「전투 기록」 소제목은 지웠다(P-54) — 로그 목록이 스스로 말한다 */}
          <div className="used-cards">
            {recentCards.map((cardId) => <GameCard key={cardId} cardId={cardId} />)}
          </div>
          <ol>{result.log.slice(-10).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
        </div>
      </div>
      <div className="actions">
        <button className="primary" type="button" onClick={() => downloadReplay(seed, actions, patrons, deck, split)}>런 JSON 반출</button>
        <button type="button" onClick={onReset}>다시 시작</button>
      </div>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article><small>{label}</small><strong>{value}</strong></article>;
}

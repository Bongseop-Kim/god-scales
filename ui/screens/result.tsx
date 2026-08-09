import { mapDepth } from "../../core/map.ts";
import type { PatronPair } from "../../sim/engine.ts";
import type { ReplayAction } from "../../sim/replay.ts";
import type { RunResult } from "../../sim/report.ts";
import { Backdrop, hero, Prop } from "../shared/backdrop.tsx";
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
  const reached = Math.min(mapDepth, result.hpCurve.length - 1);
  return (
    <>
      <Backdrop src={hero(result.won ? "win" : "loss")} tone="hero" />
      <div className="shell result-layout">
      {/* 결과 프롭 셋(P-58 §12) — 승리는 독수리·리본·빛기둥, 패배는 재·사슬·도깨비불 */}
      {(result.won ? ["surface_eagle", "surface_ribbon", "surface_light_shaft"] : ["under_ash", "under_chain", "under_wisp"])
        .map((name, index) => <Prop key={name} name={name} className={`outcome-prop o${index}`} />)}
      <header>
        {/* 「시드 N」은 개발자 표기다(P-54) — 시드는 반출 JSON에 남는 것이 맞고 화면에는 안 선다 */}
        {/* 「균형 유지 / 저울 붕괴」 배지는 지웠다(P-65) — `h1`의 「승리/패배」와 같은 말이다 */}
        <div><p className="eyebrow">{patrons.map(godName).join(" + ")} · {reached}/{mapDepth}층</p><h1>{result.won ? "승리" : "패배"}</h1></div>
      </header>
      <div className="summary-grid">
        <Summary label="최종 체력" value={result.hpCurve.at(-1) ?? 0} />
        <Summary label="전투 횟수" value={result.encounters} />
        {/* 신 이름을 상수로 박으면 다른 조합을 돌릴 때 빈칸이 된다 */}
        {patrons.map((god) => (
          <Summary key={god} label={`${godName(god)} 호의`} value={finalFavor[god] ?? 0} />
        ))}
      </div>
      {/* 개발자 로그 열 줄은 화면에서 내렸다(P-65) — `result.log`는 리포트·CLI가 계속 읽는다 */}
      <div className="map-columns">
        {["underworld", "surface"].map((region) => (
          <MapPanel key={region} grid={result.grid} region={region} taken={takenLanes(result.grid, result.pathChoices, reached)} />
        ))}
      </div>
      {/* 반출은 개발·검증용 보조 행동이라 `.ghost`로 물러난다(P-65). 지우지 않는 이유: `tools/e2e.ts`가
          이 버튼으로 「반출 → CLI 재생 동치」를 증명한다 — 가리는 것과 없애는 것은 다르다 */}
      <div className="actions">
        <button className="primary" type="button" onClick={onReset}>다시 시작</button>
        <button className="ghost" type="button" onClick={() => downloadReplay(seed, actions, patrons, deck, split)}>런 JSON 반출</button>
      </div>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <article><small>{label}</small><strong>{value}</strong></article>;
}

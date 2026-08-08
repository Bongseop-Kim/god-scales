import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { favorBoundaries, favorInitial, favorStage, interventionEveryTurns, type FavorGod, type FavorStage, type LineTrigger, type StageEffect, type StageHook } from "../../core/favor.ts";
import godDataJson from "../../data/gods.json" with { type: "json" };
import type { RunView } from "../../sim/engine.ts";
import { effectText } from "./card.tsx";
import { speak } from "./fx.ts";

/** 트리거 아홉은 `core/favor.ts`의 한 벌이다 — 게이트(`tools/validate.ts`)가 같은 것을 센다 */
type GodLines = Partial<Record<LineTrigger, string[] | Partial<Record<FavorStage, string[]>>>>;
const gods = godDataJson as (FavorGod & { name: string; lines: GodLines })[];
const godNames = new Map(gods.map(({ id, name }) => [id, name]));
/** 신 일러 다섯. 요구·컷인·발화가 같은 다섯 장을 쓴다 — 이름과 같은 자리에서 나눠 준다 */
export const godArt = import.meta.glob<string>("../../art/gods/*.webp", { eager: true, query: "?url", import: "default" });
const godLines = new Map(gods.map(({ id, lines }) => [id, lines]));

/**
 * 그 자리에서 신이 하는 말. **난수를 안 당긴다** — `n % lines.length`고 `n`은 그 자리의 턴 수나
 * 조우 수다. 새 RNG 스트림을 만들면 대사를 켜는 것만으로 배포된 replay가 통째로 어긋난다(P-46 §6).
 * 빈 문자열이면 `speak`가 아무것도 안 띄운다 — 게이트가 빈 트리거를 이미 반려하므로 배포에는 없다
 */
export function godLine(god: string, trigger: LineTrigger, n: number, stage?: FavorStage): string {
  const held = godLines.get(god)?.[trigger];
  const lines = Array.isArray(held) ? held : stage && held ? held[stage] : undefined;
  return lines?.length ? lines[n % lines.length] : "";
}

/** 이름만 데이터에서 온다. 순서는 엔진의 `gods`가 정본이다 — hex는 `ui/style.css`의 `--{id}`가 정본이다 */
export const godName = (god: string) => godNames.get(god) ?? god;

/** 단계 넷의 이름. 미터·컷인·배분 슬라이더가 같은 말을 써야 셋이 같은 사실을 가리킨다 */
export const stageName: Record<FavorStage, string> = { devotion: "헌신", calm: "평온", anger: "분노", wrath: "진노" };

/** 개입의 대상. 신은 대상을 효과마다 갖는다 — 카드와 달라서 `effectText`의 「전체 ·」를 쓸 수 없다 */
const stageTargets = { self: "나에게", enemy: "적 하나에게", all_enemies: "적 전체에게" } as const;

/**
 * 그 신이 이 단계에서 하는 일 — 조우 시작 것과 **매 턴** 것을 나눠 준다. 네 단계가 다 개입하므로
 * (P-34) 평온·분노도 빈 문자열이 아니다. 진노가 무엇을 할지 모르면 미터의 경고색이 「나쁘다」까지만
 * 말하고 끝난다
 */
/**
 * 그 신이 이 단계·이 훅에서 하는 일. **문장도 파티클도 여기 하나에서 읽는다** — 화면이
 * `data/gods.json`을 두 경로로 읽으면 컷인 문장과 파티클이 다른 개입을 그린다
 */
export const godStageEffects = (god: string, stage: FavorStage, hook: StageHook): StageEffect[] =>
  gods.find(({ id }) => id === god)?.stage_effects[stage]?.[hook] ?? [];

export function godStageText(god: string, stage: FavorStage): { start: string; turn: string } {
  const line = (effects: StageEffect[]) =>
    effects.map(({ target, ...effect }) => (effect.op === "join"
      // 합류에는 대상이 없다 — `target: "self"`는 「한 번만 터진다」는 표시고, 그것을 문장으로 읽으면 거짓말이다
      ? `${godName(effect.god ?? god)}가 적으로 합류`
      : `${stageTargets[target]} ${effectText({ target: "enemy", effects: [effect] })}`)).join(" · ");
  return {
    start: line(godStageEffects(god, stage, "on_encounter_start")),
    turn: line(godStageEffects(god, stage, "on_turn_start")),
  };
}
export const regionName = (region: string) => (region === "underworld" ? "지하" : "지상");
export const placeName = ({ region, floor }: Pick<RunView, "region" | "floor">) => `${regionName(region)} ${floor}층`;

/**
 * 단계 경계는 `favorBoundaries`에서 읽는다 — 눈금을 UI에 다시 박으면 규칙이 바뀔 때 화면만 옛 자리에
 * 남는다. 진노는 경고색이다: 그 단계의 개입이 조우 시작과 **전투 중**에 터지므로 플레이어가 그 전에 알아야 한다.
 * 전투 화면의 `PlayerActor`에 살다가 상태 바(P-54)로 왔다 — 상태 바는 App에 살아 화면 전환에 안 죽으므로
 * 경계 펄스의 `useRef`가 런 내내 이어진다
 */
export function FavorMeter({ god, value, grace }: { god: string; value: number; grace: number }) {
  const stage = favorStage(value);
  /**
   * 경계를 넘는 순간에만 한 번 펄스한다 — **그 순간 신의 행동이 바뀐다**(조우 시작 개입과 전투 중
   * 개입이 둘 다 달라진다). 직전 단계를 `useRef`에 드는 이유는 `useEffect`로 걸면 첫 렌더에
   * 미터 둘이 번쩍이기 때문이다
   */
  const seen = useRef(stage);
  const crossed = seen.current !== stage;
  useEffect(() => {
    // 미터가 펄스하는 그 프레임에 신이 말한다 — 단계가 바뀌면 그 신이 다음에 할 일이 통째로 바뀐다
    if (crossed) speak(2, god, godLine(god, "cross", value, stage));
    seen.current = stage;
  });
  const { start, turn } = godStageText(god, stage);
  const stageText = [stageName[stage], start && `조우 시작에 ${start}`, turn && `${interventionEveryTurns}턴마다 ${turn}`].filter(Boolean).join(" · ");
  return (
    <div
      className={`favor ${stage}${crossed ? " crossed" : ""}`}
      role="img"
      aria-label={`${godName(god)} 호의 ${value} ${stageText}${grace ? ` 은총 ${grace}` : ""}`}
      title={`${stageText} — 헌신 ${favorBoundaries.devotion} / 평온 ${favorBoundaries.calm} / 분노 ${favorBoundaries.anger}`}
    >
      <small>{godName(god)}</small>
      <b>{value} · {stageName[stage]}</b>
      {/* 은총은 슬롯 표시와 다른 사실이다 — 받은 **수**(다음 은혜의 tier·합성 전제)고 슬롯은 걸린 것이다 */}
      {grace > 0 && <em>은총 {grace}</em>}
      <span className="meter">
        <i style={{ "--fill": value / 100 } as CSSProperties} />
        {Object.values(favorBoundaries).filter((at) => at > 0).map((at) => (
          <span key={at} className="tick" style={{ left: `${at}%` }} />
        ))}
      </span>
    </div>
  );
}

/**
 * 상단 상태 바(P-54) — `RunHeader`(제목 + 「시드 N」 eyebrow)를 대체한다. 어떤 화면인지는 내용이
 * 이미 말하므로 제목이 없고, 시드는 반출 JSON에만 남는다. **App에 산다** — 화면 전환 밖이라
 * 런당 ~36번 다시 서지 않고, 경계 펄스·덱·약속 버튼이 여덟 런 화면 어디에나 같은 자리다
 */
export function StatusBar({ view, turn, block, onOverlay, onRestart }: {
  view: RunView;
  /** 전투에서만 온다 — 없으면 그 자리는 덱 장수가 든다 */
  turn?: number;
  block?: number;
  onOverlay: (kind: "deck" | "journal") => void;
  /** 런을 버리고 시작 화면으로. **확인 창을 여는 것까지가 여기 일이다** — 버리는 것은 App이 한다 */
  onRestart: () => void;
}) {
  return (
    <header className="status-bar">
      <div>
        <span className="vitals">
          {/* 런을 그만두는 유일한 길이 결과 화면뿐이었다(P-65). 상태 바는 런 중에만 서므로 여기가 그 집이다 */}
          <button type="button" onClick={onRestart}>다시 시작</button>
          체력 <b>{view.hp} / {view.maxHp}</b>
          방어 <b>{block ?? 0}</b>
        </span>
        <div className="favor-row">
          {view.patrons.map((god) => (
            <FavorMeter key={god} god={god} value={view.favor[god] ?? favorInitial} grace={view.grace[god] ?? 0} />
          ))}
        </div>
        <span className="whereabouts">
          {placeName(view)}{turn !== undefined && ` · ${turn}턴`}
          <button type="button" onClick={() => onOverlay("deck")}>덱 {view.deck.length}</button>
          <button type="button" onClick={() => onOverlay("journal")}>약속</button>
        </span>
      </div>
    </header>
  );
}

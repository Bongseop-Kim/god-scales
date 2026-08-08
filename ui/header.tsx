import type { FavorGod, FavorStage, LineTrigger, StageEffect, StageHook } from "../core/favor.ts";
import godDataJson from "../data/gods.json" with { type: "json" };
import type { RunView } from "../sim/engine.ts";
import { effectText } from "./card.tsx";

/** 트리거 아홉은 `core/favor.ts`의 한 벌이다 — 게이트(`tools/validate.ts`)가 같은 것을 센다 */
type GodLines = Partial<Record<LineTrigger, string[] | Partial<Record<FavorStage, string[]>>>>;
const gods = godDataJson as (FavorGod & { name: string; lines: GodLines })[];
const godNames = new Map(gods.map(({ id, name }) => [id, name]));
/** 신 일러 다섯. 요구·컷인·발화가 같은 다섯 장을 쓴다 — 이름과 같은 자리에서 나눠 준다 */
export const godArt = import.meta.glob<string>("../art/gods/*.webp", { eager: true, query: "?url", import: "default" });
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
 * 여덟 화면이 같은 머리글을 쓴다. 조합 이름은 관측에서 온다 — 상수로 박으면 제우스+아테나 말고는
 * 못 그린다. `run-header`가 그 여덟의 눈금이다: 제목은 장식이고 값은 eyebrow와 badge가 든다
 */
export function RunHeader({ seed, view, title, badge }: {
  seed: number;
  view: RunView;
  title: string;
  badge?: string;
}) {
  return (
    <header className="run-header">
      <div>
        <p className="eyebrow">
          시드 {seed} · {placeName(view)} · {view.patrons.map(godName).join(" + ")} · 체력 {view.hp}/{view.maxHp}
        </p>
        <h1>{title}</h1>
      </div>
      {badge && <strong>{badge}</strong>}
    </header>
  );
}

import type { FavorGod, FavorStage, StageEffect } from "../core/favor.ts";
import godDataJson from "../data/gods.json" with { type: "json" };
import type { RunView } from "../sim/engine.ts";
import { effectText } from "./card.tsx";

const gods = godDataJson as (FavorGod & { name: string })[];
const godNames = new Map(gods.map(({ id, name }) => [id, name]));

export const godName = (god: string) => godNames.get(god) ?? god;
/** 다섯 신의 순서. 시작 화면 범례가 이름도 색도 여기서 읽는다 — hex는 `ui/style.css`의 `--{id}`가 정본이다 */
export const godIds = gods.map(({ id }) => id);

/** 개입의 대상. 신은 대상을 효과마다 갖는다 — 카드와 달라서 `effectText`의 「전체 ·」를 쓸 수 없다 */
const stageTargets = { self: "나에게", enemy: "적 하나에게", all_enemies: "적 전체에게" } as const;

/**
 * 그 신이 이 단계에서 하는 일 — 조우 시작 것과 **매 턴** 것을 나눠 준다. 네 단계가 다 개입하므로
 * (P-34) 평온·분노도 빈 문자열이 아니다. 진노가 무엇을 할지 모르면 미터의 경고색이 「나쁘다」까지만
 * 말하고 끝난다
 */
export function godStageText(god: string, stage: FavorStage): { start: string; turn: string } {
  const hooks = gods.find(({ id }) => id === god)?.stage_effects[stage];
  const line = (effects: StageEffect[] = []) =>
    effects.map(({ target, ...effect }) => `${stageTargets[target]} ${effectText({ target: "enemy", effects: [effect] })}`).join(" · ");
  return { start: line(hooks?.on_encounter_start), turn: line(hooks?.on_turn_start) };
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

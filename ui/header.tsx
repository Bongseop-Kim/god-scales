import godDataJson from "../data/gods.json" with { type: "json" };
import type { RunView } from "../sim/engine.ts";

const godNames = new Map((godDataJson as { id: string; name: string }[]).map(({ id, name }) => [id, name]));

export const godName = (god: string) => godNames.get(god) ?? god;
export const regionName = (region: string) => (region === "underworld" ? "지하" : "지상");
export const placeName = ({ region, floor }: Pick<RunView, "region" | "floor">) => `${regionName(region)} ${floor}층`;

/**
 * 화면 넷이 같은 머리글을 쓴다. 조합 이름은 관측에서 온다 — 상수로 박으면 제우스+아테나 말고는
 * 못 그린다
 */
export function RunHeader({ seed, view, title, badge }: {
  seed: number;
  view: RunView;
  title: string;
  badge?: string;
}) {
  return (
    <header>
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

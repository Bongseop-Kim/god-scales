import { useState } from "react";
import type { CardView } from "../sim/engine.ts";
import { tokenName } from "./tokens.tsx";

const cardArt = import.meta.glob<string>("../art/cards/*.webp", { eager: true, query: "?url", import: "default" });
const opLabels: Record<string, string> = {
  damage: "피해",
  block: "방어",
  draw: "뽑기",
  energy: "에너지",
  heal: "회복",
  self_damage: "자해",
  favor_shift: "호의",
  chain: "연쇄",
};

/** 값은 엔진이 준 것을 그대로 읽는다 — UI가 data/cards.json을 따로 읽으면 같은 사실에 두 경로가 생긴다 */
export function effectText({ target, effects }: Pick<CardView, "target" | "effects">): string {
  const text = effects
    .map(({ op, value, token, stacks, when }) =>
      `${op === "apply_token" ? tokenName(token!) : opLabels[op] ?? op} ${op === "apply_token" ? stacks ?? 1 : value ?? 0}${when ? " (조건)" : ""}`)
    .join(" · ");
  return target === "all_enemies" ? `전체 · ${text}` : text;
}

export const cardCaption = (card: CardView) => `${card.cost} 에너지 · ${effectText(card)}`;

/** 보상과 카드 제거가 같은 격자를 쓴다. 손패만 퇴장 애니메이션 때문에 따로 그린다 — 은혜는 카드가 아니라 `Choice`다 */
export function CardRow({ cards, options, onSelect }: {
  cards: CardView[];
  options: string[];
  onSelect: (cardId: string) => void;
}) {
  return (
    <div className="hand">
      {cards.map((card, index) => (
        <GameCard
          key={`${card.id}-${index}`}
          cardId={card.id}
          name={card.name}
          caption={cardCaption(card)}
          disabled={!options.includes(card.id)}
          onSelect={() => onSelect(card.id)}
        />
      ))}
    </div>
  );
}

export function GameCard({ cardId, name, caption, disabled, onSelect }: {
  cardId: string;
  name?: string;
  caption?: string;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const source = cardArt[`../art/cards/${cardId}.webp`];
  const [missing, setMissing] = useState(!source);
  const face = (
    <>
      <div className={`card-art${missing ? " missing" : ""}`}>
        {source && <img src={source} alt="" loading="lazy" onError={() => setMissing(true)} />}
        <span aria-hidden="true">⚖</span>
      </div>
      <strong>{name ?? cardId}</strong>
      <small>{caption ?? "자동 전투에서 사용된 카드"}</small>
    </>
  );

  return onSelect
    ? <button className="game-card" type="button" data-card={cardId} disabled={disabled} onClick={onSelect}>{face}</button>
    : <article className="game-card" data-card={cardId}>{face}</article>;
}

import { useState } from "react";
import { MAX_SLOTS } from "../core/combat.ts";
import { fullReach, reachSlots } from "../core/targeting.ts";
import cardDataJson from "../data/cards.json" with { type: "json" };
import type { CardView } from "../sim/engine.ts";
import { cardArtCandidates, cardGod, cardTag, type CardArtSource } from "./art-keys.ts";
import { tokenName } from "./tokens.tsx";

const cardArt = import.meta.glob<string>("../art/cards/*.webp", { eager: true, query: "?url", import: "default" });
/**
 * 그림·프레임색·파티클은 **값이 아니라 이름**이라 `data/cards.json`에서 직접 읽는다 — 엔진의
 * `CardView`는 값만 싣는다(`sim/engine.ts:130`). 적 이름을 `data/enemies.json`에서 읽는 자리와 같다.
 * 129개 id가 그림 30장으로 떨어지는 규칙은 `ui/art-keys.ts`에 있고 `tools/art.ts`가 같은 것을 쓴다
 */
const cardFace = new Map((cardDataJson as CardArtSource[]).map((card) => [card.id, {
  art: cardArtCandidates(card).map((key) => cardArt[`../art/cards/${key}.webp`]).find(Boolean),
  god: cardGod(card),
  tag: cardTag(card),
}]));

/** 카드를 낼 때 튀는 파티클의 태그. 전투 화면이 이걸로 `art/particle/`을 고른다 */
export const cardTagOf = (cardId: string): string | undefined => cardFace.get(cardId)?.tag;
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

/**
 * 사거리 아홉 모양의 한글 이름. **이 표는 화면에만 있다** — 규칙은 `reachOk` 정규식 하나이므로 열째
 * 모양을 만들어도 코드가 안 바뀌고, 모르는 마스크는 아래에서 `칸 0·3` 꼴로 떨어진다
 */
const reachNames: Record<string, string> = {
  "0123": "전체", "0": "앞 한 칸", "01": "앞 둘", "012": "앞 셋",
  "12": "가운데 둘", "123": "뒤 셋", "23": "뒤 둘", "3": "뒤 한 칸", "03": "양 끝",
};
/** 네 칸 그림. 아홉 모양은 글자만으로 안 읽힌다 — 어느 칸에 닿는지가 그림이어야 한 눈에 든다 */
export function reachText(reach = fullReach): string {
  const slots = reachSlots(reach);
  const bars = Array.from({ length: MAX_SLOTS }, (_, slot) => (slots.includes(slot) ? "▮" : "▯")).join("");
  return `${bars} ${reachNames[reach] ?? `칸 ${slots.join("·")}`}`;
}

/** 자기 대상 카드에는 사거리 칸이 없다 — 닿을 적이 없으므로 그리면 거짓말이다 */
export const cardCaption = (card: CardView) =>
  `${card.cost} 에너지 · ${card.target === "self" ? "" : `${reachText(card.reach)} · `}${effectText(card)}`;

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
  const face = cardFace.get(cardId);
  const source = face?.art;
  const [missing, setMissing] = useState(!source);
  const art = (
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
    ? <button className="game-card" type="button" data-card={cardId} data-god={face?.god} disabled={disabled} onClick={onSelect}>{art}</button>
    : <article className="game-card" data-card={cardId} data-god={face?.god}>{art}</article>;
}

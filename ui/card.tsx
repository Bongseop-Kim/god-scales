import { useState } from "react";

const cardArt = import.meta.glob<string>("../art/cards/*.webp", { eager: true, query: "?url", import: "default" });

export function GameCard({ cardId }: { cardId: string }) {
  const source = cardArt[`../art/cards/${cardId}.webp`];
  const [missing, setMissing] = useState(!source);

  return (
    <article className="game-card" data-card={cardId}>
      <div className={`card-art${missing ? " missing" : ""}`}>
        {source && <img src={source} alt="" loading="lazy" onError={() => setMissing(true)} />}
        <span aria-hidden="true">⚖</span>
      </div>
      <strong>{cardId}</strong>
      <small>자동 전투에서 사용된 카드</small>
    </article>
  );
}

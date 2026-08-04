const cardArt = import.meta.glob<string>("../art/cards/*.webp", { eager: true, query: "?url", import: "default" });

export function cardMarkup(cardId: string): string {
  const source = cardArt[`../art/cards/${cardId}.webp`];
  return `<article class="game-card" data-card="${cardId}">
    <div class="card-art ${source ? "" : "missing"}">${source ? `<img src="${source}" alt="" loading="lazy" />` : ""}<span aria-hidden="true">⚖</span></div>
    <strong>${cardId}</strong><small>자동 전투에서 사용된 카드</small>
  </article>`;
}

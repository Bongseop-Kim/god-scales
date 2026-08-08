import type { CombatState } from "./state.ts";

export const HAND_LIMIT = 10;

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function drawCards(combat: CombatState, count: number, random: () => number): void {
  for (let drawn = 0; drawn < count && combat.hand.length < HAND_LIMIT; drawn += 1) {
    if (combat.drawPile.length === 0 && combat.discardPile.length > 0) {
      combat.drawPile = shuffle(combat.discardPile, random);
      combat.discardPile = [];
    }
    const card = combat.drawPile.shift();
    if (!card) return;
    combat.hand.push(card);
  }
}

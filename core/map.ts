import { finishRestFavor } from "./favor.ts";
import type { GameState } from "./state.ts";

export const regions = ["underworld", "surface"] as const;
export const floorsPerRegion = 6;
export const restHealing = 25;
export const enemyDamageScale = 0.45;
export type MapNodeType = "combat" | "rest" | "boss";

export function mapNode(node: number): { region: (typeof regions)[number]; floor: number; options: MapNodeType[] } {
  if (node < 0 || node >= regions.length * floorsPerRegion) throw new Error(`Invalid map node: ${node}`);
  const floor = (node % floorsPerRegion) + 1;
  return {
    region: regions[Math.floor(node / floorsPerRegion)],
    floor,
    options: floor === 6 ? ["boss"] : floor === 3 || floor === 5 ? ["combat", "rest"] : ["combat"],
  };
}

export function advanceMap(state: GameState, choice: MapNodeType): void {
  const node = mapNode(state.map.node);
  if (!node.options.includes(choice)) throw new Error(`${choice} is unavailable at ${node.region} ${node.floor}`);
  state.map.completed.push(`${node.region}:${node.floor}:${choice}`);
  state.map.node += 1;
}

export function takeRest(
  state: GameState,
  patrons: string[],
  deck: string[],
  choice: "heal" | "remove",
  cardId?: string,
): void {
  if (choice === "heal") state.combat.player.hp = Math.min(state.combat.player.maxHp, state.combat.player.hp + restHealing);
  else {
    const index = deck.indexOf(cardId ?? "");
    if (index < 0) throw new Error(`Cannot remove card: ${cardId ?? "none"}`);
    deck.splice(index, 1);
  }
  finishRestFavor(state.favor, patrons);
}

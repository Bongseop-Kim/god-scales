export type CardId = string;

export type CombatState = {
  hp: number;
  block: number;
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
  enemies: { id: string; hp: number; block: number }[];
};

export type GameState = {
  seed: number;
  combat: CombatState;
  favor: Record<string, number>;
  map: { node: number; completed: string[] };
};

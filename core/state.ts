export type CardId = string;

export const tokenNames = [
  "shock",
  "displace",
  "soaked",
  "bulwark",
  "deflect",
  "bleed",
  "frenzy",
  "mark",
  "crit",
] as const;

export type TokenName = (typeof tokenNames)[number];
export type Tokens = Partial<Record<TokenName, number>>;

export type ActorState = {
  id: string;
  hp: number;
  maxHp: number;
  block: number;
  tokens: Tokens;
};

export type EnemyState = ActorState & { patternIndex: number };
export type CombatOutcome = "ongoing" | "victory" | "defeat" | "timeout";

export type CombatState = {
  turn: number;
  energy: number;
  outcome: CombatOutcome;
  timeout: boolean;
  player: ActorState;
  drawPile: CardId[];
  hand: CardId[];
  discardPile: CardId[];
  enemies: EnemyState[];
};

export type GameState = {
  seed: number;
  combat: CombatState;
  favor: Record<string, number>;
  map: { node: number; completed: string[] };
};

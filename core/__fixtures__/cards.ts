import type { Card, Op } from "../rules";

const ops: Op[] = ["damage", "block", "draw", "energy", "heal", "self_damage", "apply_token", "favor_shift"];

export const operatorCards: Card[] = ops.map((op) => ({
  id: `fixture_${op}`,
  name: op,
  patron: "zeus",
  cost: 0,
  target: op === "damage" || op === "apply_token" ? "enemy" : "self",
  effects: [{ op, value: 1, token: op === "apply_token" ? "shock" : undefined }],
  tags: ["utility"],
}));

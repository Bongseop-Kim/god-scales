/**
 * 은혜 45줄 생성기. 설계 단위는 **열다섯**(신 5 × 설계 3)이고, tier 3단은
 * 같은 줄의 수치만 다르므로 여기서 뽑는다. 산출물은 staging/graces.json이고 게이트가 반려하면 여기를 고친다.
 */
import { writeFileSync } from "node:fs";

type Effect = { op: string; value?: number; token?: string; stacks?: number; when?: string };
type Design = {
  id: string;
  patron: string;
  text: string;
  /** tier 2 · 4 · 6 순서 */
  tiers: [Effect[], Effect[], Effect[]];
};

const token = (name: string, stacks: number, when?: string): Effect => ({ op: "apply_token", token: name, stacks, ...(when ? { when } : {}) });
const op = (name: string, value: number, when?: string): Effect => ({ op: name, value, ...(when ? { when } : {}) });

/**
 * 조건은 `turn > 3`을 쓴다. `turn > 1`은 조우 평균 7턴에서 6턴을 사는데 게이트는 `when`을 무조건
 * 0.5로 재므로 밴드가 실제보다 후하게 읽힌다 — 4턴부터 사는 `turn > 3`이 0.5에 가장 가깝다
 */
const late = "turn > 3";

/** tier 2는 조건부, tier 4는 무조건, tier 6은 tier 4에 조건부 증분을 더한다. */
const designs: Design[] = [
  // 제우스 — 감전은 이번 턴의 모든 피해를 키운다. 조합 승률이 다섯 신 중 최하라 밴드 위쪽에 둔다
  { id: "grace_zeus_attack_shock", patron: "zeus", text: "네 손끝에서 갈라진다.",
    tiers: [[token("shock", 1)], [token("shock", 2)], [token("shock", 2), token("shock", 1, late)]] },
  { id: "grace_zeus_defend_block", patron: "zeus", text: "천둥이 먼저 오고 벼락이 뒤에 온다. 그 사이가 네 방패다.",
    tiers: [[op("block", 1)], [op("block", 2)], [op("block", 2), op("block", 1, late)]] },
  { id: "grace_zeus_utility_draw", patron: "zeus", text: "하늘은 네가 보기 전에 읽는다.",
    tiers: [[op("draw", 1, late)], [op("draw", 1)], [op("draw", 1), op("draw", 1, late)]] },

  // 포세이돈 — 침수는 적의 공격을 깎는다. 완화 상한 0.30에 여유가 0.6뿐이라 완화 은혜는 하나뿐이다
  { id: "grace_poseidon_attack_soaked", patron: "poseidon", text: "닿은 것은 모두 젖는다.",
    tiers: [[token("soaked", 1, late)], [token("soaked", 1)], [token("soaked", 1), token("soaked", 1, late)]] },
  { id: "grace_poseidon_defend_draw", patron: "poseidon", text: "물러서는 자리에서 해류가 보인다.",
    tiers: [[op("draw", 1, late)], [op("draw", 1)], [op("draw", 1), op("draw", 1, late)]] },
  { id: "grace_poseidon_token_heal", patron: "poseidon", text: "밀물은 상처를 씻고 돌아간다.",
    tiers: [[op("heal", 1)], [op("heal", 2)], [op("heal", 2), op("heal", 1, late)]] },

  // 아테나 — 방벽은 턴을 넘어 남는다. 가시는 완화가 아니라서 상한에 걸리지 않는 유일한 아테나 토큰이다
  { id: "grace_athena_attack_damage", patron: "athena", text: "지혜는 급소를 먼저 안다.",
    tiers: [[op("damage", 1, late)], [op("damage", 1)], [op("damage", 1), op("damage", 1, late)]] },
  { id: "grace_athena_defend_bulwark", patron: "athena", text: "지혜는 같은 벽을 두 번 쌓지 않는다.",
    tiers: [[token("bulwark", 1, late)], [token("bulwark", 1)], [token("bulwark", 1), token("bulwark", 1, late)]] },
  { id: "grace_athena_utility_thorns", patron: "athena", text: "방패에는 언제나 가장자리가 있다.",
    tiers: [[token("thorns", 1, "hp_pct(self) < 50")], [token("thorns", 1)], [token("thorns", 1), token("thorns", 1, late)]] },

  // 아레스 — 출혈은 방어를 통과한다. 광란은 다음 한 방을 키운다
  { id: "grace_ares_attack_bleed", patron: "ares", text: "상처는 네가 떠난 뒤에 일한다.",
    tiers: [[token("bleed", 1, late)], [token("bleed", 1)], [token("bleed", 1), token("bleed", 1, late)]] },
  { id: "grace_ares_defend_frenzy", patron: "ares", text: "버틴 만큼 화가 쌓인다.",
    tiers: [[token("frenzy", 1, late)], [token("frenzy", 1)], [token("frenzy", 1), token("frenzy", 1, late)]] },
  { id: "grace_ares_token_block", patron: "ares", text: "낙인을 새기는 손은 비어 있지 않다.",
    tiers: [[op("block", 1)], [op("block", 2)], [op("block", 2), op("block", 1, late)]] },

  // 아르테미스 — 표식은 스택이 아니라 배수다(`dealDamage`가 `> 0`만 본다). tier는 피해로 올린다
  { id: "grace_artemis_attack_mark", patron: "artemis", text: "겨눈 것은 이미 맞은 것이다.",
    tiers: [[token("mark", 1, late)], [token("mark", 1)], [token("mark", 1), op("damage", 1, late)]] },
  { id: "grace_artemis_token_block", patron: "artemis", text: "숲은 사냥꾼을 숨겨 준다.",
    tiers: [[op("block", 1)], [op("block", 2)], [op("block", 2), op("block", 1, late)]] },
  { id: "grace_artemis_utility_crit", patron: "artemis", text: "사냥은 한 번에 끝난다.",
    tiers: [[token("crit", 1, "enemy_count() >= 2")], [token("crit", 1)], [token("crit", 1), token("crit", 1, late)]] },
];

const tiers = [2, 4, 6] as const;
const rows = designs.flatMap((design) =>
  tiers.map((tier, index) => ({
    id: design.id,
    patron: design.patron,
    tier,
    text: design.text,
    effects: design.tiers[index],
  })));

console.log(`${rows.length}줄`);
writeFileSync("staging/graces.json", `${JSON.stringify(rows, null, 2)}\n`);
console.log("staging/graces.json");

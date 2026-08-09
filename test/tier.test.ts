import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { rewardOffer, runSteps, type PatronPair } from "../sim/engine";
import { cardTier, isValueAllowed } from "../tools/value";

type Card = { id: string; name: string; patron?: string; patron_pair?: string[]; tier?: number; cost: number; target: string; effects: { op: string; value?: number }[]; tags: string[] };
const cards = JSON.parse(readFileSync("data/cards.json", "utf8")) as Card[];
const tierOf = new Map(cards.map((card) => [card.id, cardTier(card)]));

/** 값만 다른 카드 하나. cost 1이라 `damage`가 곧 기대값이다 — 경계값을 정확히 놓을 수 있는 유일한 꼴 */
const probe = (value: number, tier: number): Card => ({
  id: "card_probe", name: "탐침", cost: 1, target: "enemy", effects: [{ op: "damage", value }], tags: ["attack"],
  ...(tier === 3 ? { patron_pair: ["ares", "zeus"] } : { patron: "ares", tier }),
} as Card);

describe("value tiers", () => {
  /**
   * 겹치던 옛 밴드에서는 값 7.0짜리 카드가 patron `[4, 8]`과 융합 `[6, 10]` **둘 다**였고, 그래서
   * 「융합이 최강」이 거짓이었다. 반개구간이 그것을 닫는다 — 경계값이 정확히 한 칸에만 든다
   */
  it("puts every boundary value in exactly one band", () => {
    for (const [value, tier] of [[4, 1], [7.9, 1], [8, 2], [9.9, 2], [10, 3], [13, 3]] as const) {
      expect([1, 2, 3].filter((step) => isValueAllowed(probe(value, step))), `value ${value}`).toEqual([tier]);
    }
    // 밴드 밖은 어느 칸도 안 받는다 — 아래로도 위로도
    for (const value of [3.9, 13.1]) {
      expect([1, 2, 3].filter((step) => isValueAllowed(probe(value, step))), `value ${value}`).toEqual([]);
    }
  });

  it("keeps the shipped pool inside its own step", () => {
    expect([1, 2, 3].map((tier) => cards.filter((card) => cardTier(card) === tier).length)).toEqual([139, 30, 10]);
    expect(cards.filter((card) => !isValueAllowed(card)).map(({ id }) => id)).toEqual([]);
    // 융합은 `tier`를 적지 않는다 — `patron_pair`가 곧 3이고, 두 곳에 적으면 어긋난다
    expect(cards.filter(({ patron_pair, tier }) => patron_pair && tier !== undefined)).toEqual([]);
    // 신마다 여섯 장이다 — 3택1이 tier2만으로도 서고(정예·보스가 그것을 요구한다), 런당 2~3회뿐인
    // 그 자리에서 조합의 여섯 장을 사실상 다 보게 된다(P-44 §4)
    for (const god of ["zeus", "poseidon", "athena", "ares", "artemis"]) {
      expect(cards.filter((card) => card.patron === god && cardTier(card) === 2), god).toHaveLength(6);
    }
  });
});

describe("tier2 reward slots", () => {
  /**
   * 일반 전투는 두 지역 다 tier1뿐이고 정예·보스만 세 자리다(자리 수를 정한 실측은 `tier2Slots`의
   * 표에 있다). 갈래 종류는 관측의 격자에서 읽고, **갈래는 봇에게 안 맡긴다** — `choosePath`는 체력을
   * 보고 고르므로 30시드를 돌려도 정예를 한 번도 안 밟는다.
   *
   * **신을 꺾은 조우는 갈래와 무관하게 셋이다**(P-47) — 판 위에서 실제로 정예였다. 그래서 판에 신이
   * 섰던 조우는 갈래가 아니라 `god` 칸으로 센다: 안 가르면 「일반 전투는 0」이 진노를 만난 자리에서
   * 흔들려 규칙이 둘 다 안 서게 된다
   */
  it("gives normal combat none and elite and boss all three", () => {
    const counts = new Map<string, Set<number>>();
    for (let seed = 1; seed <= 65; seed += 1) {
      const steps = runSteps(seed);
      let step = steps.next();
      let sawGod = false;
      while (!step.done) {
        if (step.value.phase === "path") sawGod = false;
        if (step.value.phase === "card") sawGod ||= step.value.observation.enemies.some(({ id }) => id.startsWith("enemy_god_"));
        if (step.value.phase === "reward" && !step.value.observation.questReward) {
          const { depth, lane, grid, region } = step.value.observation;
          const key = sawGod ? "god" : `${region}:${grid[depth][lane]}`;
          const tier2 = step.value.options.filter((id) => tierOf.get(id) === 2).length;
          counts.set(key, (counts.get(key) ?? new Set()).add(tier2));
          sawGod = false;
        }
        const elite = step.value.phase === "path" ? step.value.options.find((option) => option.endsWith(":elite")) : undefined;
        step = steps.next(elite ?? step.value.bot);
      }
    }
    // 진노 신은 시작 호의로 직접 세운다 — 우연히 그 단계까지 내려가는 시드를 찾는 것은 규칙 검증이 아니다
    const wrath = runSteps(1, undefined, undefined, undefined, 100);
    let step = wrath.next();
    let sawGod = false;
    while (!step.done) {
      if (step.value.phase === "card") sawGod ||= step.value.observation.enemies.some(({ id }) => id.startsWith("enemy_god_"));
      if (step.value.phase === "reward" && sawGod && !step.value.observation.questReward) {
        counts.set("god", new Set([step.value.options.filter((id) => tierOf.get(id) === 2).length]));
        break;
      }
      step = wrath.next(step.value.bot);
    }
    expect(counts.get("god")).toEqual(new Set([3]));
    expect(counts.get("underworld:combat")).toEqual(new Set([0]));
    expect(counts.get("surface:combat")).toEqual(new Set([0]));
    expect(counts.get("surface:elite")).toEqual(new Set([3]));
    expect(counts.get("underworld:boss")).toEqual(new Set([3]));
    expect(counts.get("surface:boss")).toEqual(new Set([3]));
    // 저승이 사실상 tier1뿐인 것은 **저승에 정예 편성이 없다**는 데이터가 든다 — 규칙이 아니다
    expect(counts.has("underworld:elite")).toBe(false);
  });

  /** 후보가 자리 수보다 적으면 뽑기 루프가 영원히 돈다. 배포 데이터로는 못 만드는 상황이라 자리 수로 만든다 */
  it("throws instead of looping when the tier2 pool is short", () => {
    const patrons: PatronPair = ["zeus", "athena"];
    expect(() => rewardOffer(createRng(1), patrons, 12)).not.toThrow();
    expect(() => rewardOffer(createRng(1), patrons, 13)).toThrow(/needs 13 tier2/);
  });

  /**
   * **옛 replay가 안 깨진다.** tier2를 나중에 뽑으면 같은 난수열에서 tier1 결과가 흔들린다 — 자리가
   * 0인 저승 보상은 P-39 이전의 뽑기와 카드열이 같아야 한다. 아래 `legacy`가 그 이전 구현이고,
   * tier2 15장은 전량 신규이므로 **`tier`가 없는 patron 카드**가 곧 그때의 후보 배열이다
   */
  it("draws the same tier1 cards as the old offer when no slot goes to tier2", () => {
    const legacyPool = cards.filter(({ patron, tier }) => patron && tier === undefined);
    const legacy = (random: () => number, patrons: PatronPair): string[] => {
      const candidates = legacyPool.filter(({ patron }) => patrons.includes(patron as never));
      const offer: string[] = [];
      while (offer.length < 3) {
        const { id } = candidates[Math.floor(random() * candidates.length)];
        if (!offer.includes(id)) offer.push(id);
      }
      return offer;
    };
    for (const patrons of [["zeus", "athena"], ["ares", "artemis"], ["poseidon", "zeus"]] as PatronPair[]) {
      for (let seed = 1; seed <= 20; seed += 1) {
        // 저승 여섯 층 × 갈래 셋. 스트림은 `seed * 1000 + nodeSeed`고 nodeSeed는 `depth * 3 + lane`이다
        for (let nodeSeed = 0; nodeSeed < 18; nodeSeed += 1) {
          const key = `${patrons.join("+")} ${seed}/${nodeSeed}`;
          expect(rewardOffer(createRng(seed * 1000 + nodeSeed), patrons, 0), key)
            .toEqual(legacy(createRng(seed * 1000 + nodeSeed), patrons));
        }
      }
    }
  });
});

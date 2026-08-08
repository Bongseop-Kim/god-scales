import { describe, expect, it } from "vitest";
import demandData from "../data/demands.json" with { type: "json" };
import godData from "../data/gods.json" with { type: "json" };
import { betDeposit, demandEnemies, demandPenalty, demandSatisfied, demandSettled, pairKey, parseCondition, payDeposit, resolveDemand, rivals, ruleText, takeSide, type Demand } from "../core/demands";
import { godLine } from "../ui/shared/header";
import { createCombat } from "../core/combat";
import type { GameState } from "../core/state";
import { run, runSteps, simulateStratified, watchDemand } from "../sim/engine";
import { summarize } from "../sim/report";
import type { ReplayAction } from "../sim/replay";
import { validateItems } from "../tools/validate";

const demands = demandData as Demand[];
const athena = demands.find(({ id }) => id === "demand_athena_safe")!;
const zeus = demands.find(({ id }) => id === "demand_zeus_swift")!;
/** 첫 요구만 고정하고 나머지는 봇에게 맡긴다 — 곡선이 처음 갈라지는 자리가 그 조건 하나의 값이다 */
const firstAnswer = (choice: string): ReplayAction[] => [{ type: "demand", choice }];
const everyAnswer = (choice: string): ReplayAction[] =>
  Array.from({ length: 14 }, () => ({ type: "demand", choice }));

const state = (): GameState => ({
  seed: 1,
  favor: { zeus: 50, athena: 50 },
  grace: {},
  graceSlots: {},
  map: { depth: 0, lane: 1, grid: [], completed: [] },
  combat: createCombat(1, [], []),
});

describe("demands", () => {
  it("keeps the core rival set equal to data/gods.json", () => {
    // core는 데이터를 읽지 않으므로 이 한 벌만 사본이다. 어긋나면 게이트와 런타임이 다른 게임을 판정한다
    const fromData = new Set(godData.flatMap((god) => god.rivals.map((rival) => pairKey(god.id, rival))));
    expect(rivals).toEqual(fromData);
  });

  /** 신 다섯이 조건을 하나씩 갖는다 — 하나라도 비면 그 조합의 내기표가 한 칸짜리로 선다 */
  it("gives every god exactly one condition", () => {
    expect(demands.map(({ patron }) => patron).sort()).toEqual(godData.map(({ id }) => id).sort());
    expect(godData.flatMap(({ demands: owned }) => owned).sort()).toEqual(demands.map(({ id }) => id).sort());
  });

  /**
   * 벌금은 **편을 드는 순간** 나가고 보상은 **지켰을 때만** 들어온다 — 둘이 갈려 있어야 내기표가
   * 「받을까 말까」가 아니라 계산이 된다(옛 시련의 선불 대가가 서던 자리다)
   */
  it("charges the side it took up front and pays only what the fight kept", () => {
    expect(demandPenalty("zeus", "poseidon")).toEqual({ amount: -18, key: "rival_18" });
    expect(demandPenalty("zeus", "athena")).toEqual({ amount: -9, key: "non_rival_9" });
    expect(demandPenalty("zeus", "artemis")).toEqual({ amount: 0, key: "none" });
    const favor = { zeus: 50, poseidon: 50 };
    expect(takeSide(favor, "zeus", "poseidon")).toBe("rival_18");
    expect(favor).toEqual({ zeus: 50, poseidon: 32 });
    // 보상이 없으면 못 지킨 것이다 — 실패 벌금은 없고 이미 나간 값도 안 돌아온다
    resolveDemand(favor, "zeus", undefined);
    expect(favor).toEqual({ zeus: 50, poseidon: 32 });
    // 값은 데이터가 든다 — 상수를 여기 적으면 데이터와 어긋나는 두 번째 진실이 된다
    resolveDemand(favor, "zeus", athena.reward);
    expect(favor).toEqual({ zeus: 50 + athena.reward.favor, poseidon: 32 });
  });

  /**
   * 판돈은 **확정하는 순간** 실제로 내려간다. 바닥이 1이라 데이터가 적은 값이 아니라 **빠진 양**을
   * 돌려주고, 성공했을 때 되돌리는 것도 그 값이다 — 그래야 상한이 조용히 늘어나는 자리가 없다
   */
  it("takes the deposit right away and reports what actually left", () => {
    const game = state();
    expect(payDeposit(game, betDeposit)).toBe(betDeposit);
    expect([game.combat.player.maxHp, game.combat.player.hp]).toEqual([100 - betDeposit, 100 - betDeposit]);
    // 바닥은 1이다 — 상한보다 큰 판돈은 그만큼만 나간다
    game.combat.player.maxHp = 5;
    expect(payDeposit(game, betDeposit)).toBe(4);
    expect(game.combat.player.maxHp).toBe(1);
  });

  it("keeps an omen quest across fights and pays a chosen card when completed", () => {
    const steps = runSteps(3, undefined, ["zeus", "athena"]);
    let step = steps.next();
    let afterOmen = false;
    const activeDepths = new Set<number>();
    let questReward = false;
    while (!step.done && !questReward) {
      const decision = step.value;
      if (afterOmen) {
        expect(decision.phase).toBe("demand");
        if (decision.phase !== "demand") throw new Error("omen did not offer a quest");
        expect(decision.observation.quest).toBe(true);
      }
      afterOmen = decision.phase === "path" && decision.bot.endsWith(":omen");
      if (decision.phase === "card" && decision.observation.promises.some(({ quest }) => quest)) activeDepths.add(decision.observation.depth);
      if (decision.phase === "reward" && decision.observation.quest) {
        questReward = true;
        expect(decision.options).not.toContain("");
        expect(decision.options.length).toBeGreaterThan(3);
        expect(decision.observation.cards.every(({ id }) => id.startsWith("card_zeus_"))).toBe(true);
      }
      step = steps.next(decision.bot);
    }
    expect(activeDepths.size).toBeGreaterThan(1);
    expect(questReward).toBe(true);
  });

  it("pays a demand only when the fight actually satisfied it", () => {
    /**
     * 조건은 전투 **앞에서** 묻고 그 전투로 판정한다. 그래서 「첫 요구」를 곡선이 **처음 갈라지는
     * 자리**로 찾는다 — 그 자리까지 두 런은 같은 칸을 같은 시드로 걸었으므로 차이는 조건 하나다.
     *
     * 지키는 시드와 안 지키는 시드는 회차마다 자리를 바꾼다 — 아래 둘은 400시드를 훑어 고른다
     */
    const first = [...Array(400).keys()].map((index) => index + 1).find((seed) => {
      const played = run(seed, undefined, firstAnswer("zeus"));
      const watched = run(seed, undefined, firstAnswer(watchDemand));
      const at = played.favorCurve.findIndex((point, index) => index < watched.favorCurve.length
        && JSON.stringify(point) !== JSON.stringify(watched.favorCurve[index]));
      if (at <= 0) return false;
      // 지킨 자리라야 값이 실제로 들어온다 — 그 차이가 곧 조건 하나의 값이다
      return played.favorCurve[at].zeus - watched.favorCurve[at].zeus === zeus.reward.favor;
    });
    expect(first, "no seed keeps its first zeus condition").toBeDefined();
    const played = run(first!, undefined, firstAnswer("zeus"));
    const watched = run(first!, undefined, firstAnswer(watchDemand));
    const at = played.favorCurve.findIndex((point, index) => JSON.stringify(point) !== JSON.stringify(watched.favorCurve[index]));
    expect(played.favorCurve[at].athena - watched.favorCurve[at].athena).toBe(demandPenalty("zeus", "athena").amount);

    // 편든 신은 "지킨 신"이다 — 전부 관망하면 상대 쪽으로 넘어간다
    const ignored = run(first!, undefined, everyAnswer(watchDemand));
    expect(ignored.actions.filter(({ type }) => type === "demand").map(({ choice }) => choice)).toContain(watchDemand);

    // 요구 대비 지킴 비율이 실제로 1이 아니다 — 조건 판정이 걸린다는 증거다
    const asked = Object.values(run(1).demandOutcomes);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.some(([count, kept]) => kept < count)).toBe(true);
  });

  it("evaluates a condition and reads the enemy count it needs", () => {
    const poseidon = demands.find(({ id }) => id === "demand_poseidon_wave")!;
    const { target } = parseCondition(poseidon.condition);
    expect(demandSatisfied(poseidon.condition, { hit_targets_in_turn: target })).toBe(true);
    expect(demandSatisfied(poseidon.condition, { hit_targets_in_turn: target - 1 })).toBe(false);
    // `target_spread`만 조우 크기를 요구한다 — 나머지 축은 요구의 하한을 그대로 쓴다. 값은 데이터가 든다
    expect(demandEnemies(poseidon.condition, 1)).toBe(poseidon.min_enemies);
    expect(demandEnemies(athena.condition, 1)).toBe(1);
  });

  /**
   * 게이트의 요구 규칙은 전부 **판정할 수 있는가**만 잰다. 판돈은 데이터가 아니라 내기표가 들고,
   * 「걸 만한가」는 조합 승률 하한이 이미 잡는다 (P-59)
   */
  it("rejects a condition the engine or the screen cannot read", () => {
    const broken = (change: (demand: Demand) => void): Demand => {
      const copy = structuredClone(athena);
      change(copy);
      return copy;
    };
    // 사람 말로 못 옮기는 좌변은 화면에서 빈 줄이 된다
    const unknownFact = broken((demand) => { demand.condition = "blood_spilled <= 20"; });
    // 비교자가 곧 polarity다 — 어긋나면 화면과 판정이 갈린다
    const flipped = broken((demand) => { demand.polarity = "+"; });
    // 조우 크기 하한이 조건과 어긋나면 지킬 수 없는 약속이 뜬다
    const unreachable = broken((demand) => { demand.condition = "hit_targets_in_turn >= 3"; demand.polarity = "+"; });
    // 지켜도 아무것도 안 들어오는 조건은 결정이 아니다
    const empty = broken((demand) => { demand.reward = { favor: 0 }; });
    for (const item of [unknownFact, flipped, unreachable, empty]) {
      expect(validateItems([item as unknown as Record<string, unknown>]).rejected).toEqual([{ id: athena.id, failure: "demand_axis" }]);
    }
    expect(validateItems(demands as unknown as Record<string, unknown>[]).rejected).toEqual([]);
  });

  /**
   * 다섯 줄의 조건이 **다 사람 말로 떨어진다.** 게이트가 `factName`에 없는 좌변을 반려하므로 이 줄이
   * 깨지는 길은 하나뿐이다 — 표에 없는 사실을 새로 쓰는 것이고, 그러면 게이트가 먼저 막는다
   */
  it("적는다 — 다섯 줄의 조건이 전부 한글 한 줄이 된다", () => {
    const rules = demands.map(({ condition }) => ruleText(condition));
    expect(rules).toHaveLength(5);
    for (const rule of rules) expect(rule).toMatch(/^[가-힣 ]+ \d+ (이상|이하|초과|같음)$/);
    expect(ruleText(athena.condition)).toBe(`이 조우에서 잃은 체력 ${parseCondition(athena.condition).target} 이하`);
    expect(ruleText(zeus.condition)).toBe(`이 조우에 쓴 턴 ${parseCondition(zeus.condition).target} 이하`);
  });

  /**
   * **확정은 비교 연산자가 가른다.** 사실 다섯이 단조 비감소라(`sim/engine.ts`) 달성형은 처음 넘는
   * 순간 성공이 굳고 유지형은 처음 넘는 순간 실패가 굳는다 — 이 한 줄 위에 진행 막대와 알림이 선다
   */
  it("굳는다 — 달성형은 성공으로, 유지형은 실패로 확정된다", () => {
    const hurt = demands.find(({ id }) => id === "demand_ares_hurt")!;
    const edge = (demand: Demand) => parseCondition(demand.condition).target;
    expect(demandSettled(athena.condition, { damage_taken: edge(athena) })).toBeUndefined();
    expect(demandSettled(athena.condition, { damage_taken: edge(athena) + 1 })).toBe("broken");
    expect(demandSettled(hurt.condition, { damage_taken: edge(hurt) })).toBeUndefined();
    expect(demandSettled(hurt.condition, { damage_taken: edge(hurt) + 1 })).toBe("kept");
    // 제우스의 턴 조건도 유지형이다 — 한 턴 더 쓰면 굳는다
    expect(demandSettled(zeus.condition, { turns: edge(zeus) })).toBeUndefined();
    expect(demandSettled(zeus.condition, { turns: edge(zeus) + 1 })).toBe("broken");
    // 확정이 사실과 어긋나면 화면이 「지켰다」고 적은 뒤에 호의가 다르게 움직인다
    for (const { condition } of demands) {
      for (const value of [0, 1, 2, 3, 5, 8, 14, 20, 27]) {
        const facts = { hit_targets_in_turn: value, damage_taken: value, tokens_applied: value, tokens_applied_in_turn: value, turns: value };
        const settled = demandSettled(condition, facts);
        if (settled) expect(demandSatisfied(condition, facts)).toBe(settled === "kept");
      }
    }
  });

  /**
   * 트리거 아홉에 신 다섯이 다 줄을 갖는다. **게이트가 이미 반려하지만** 화면이 읽는 경로(`godLine`)와
   * 게이트가 세는 경로가 갈릴 수 있다 — 여기서 그 둘을 같은 자리에 세운다. 고르는 것은 나머지 연산이다
   */
  it("말한다 — 트리거 아홉 × 단계 넷이 다 줄을 갖고 난수를 안 당긴다", () => {
    for (const { id } of godData) {
      for (const trigger of ["demand_offer", "demand_kept", "demand_broken", "tear", "join", "reconcile"] as const) {
        expect(godLine(id, trigger, 0).trim(), `${id}:${trigger}`).not.toBe("");
      }
      for (const trigger of ["encounter", "intervene", "cross"] as const) {
        for (const stage of ["devotion", "calm", "anger", "wrath"] as const) {
          expect(godLine(id, trigger, 0, stage).trim(), `${id}:${trigger}:${stage}`).not.toBe("");
          // 같은 `n`이면 같은 줄이다 — 새 RNG 스트림이 끼면 대사를 켜는 것만으로 replay가 어긋난다
          expect(godLine(id, trigger, 7, stage)).toBe(godLine(id, trigger, 7, stage));
        }
      }
    }
  });

  it("stratifies all ten pairings into the required penalty class", () => {
    const distribution = summarize(simulateStratified(100)).conflict_penalty_dist;
    expect(Object.keys(distribution)).toHaveLength(10);
    for (const [pairing, counts] of Object.entries(distribution)) {
      const expected = pairing.includes("artemis") ? "none" : ["zeus+poseidon", "athena+ares"].includes(pairing) ? "rival_18" : "non_rival_9";
      expect(counts).toEqual({ [expected]: 10 });
    }
  });
});

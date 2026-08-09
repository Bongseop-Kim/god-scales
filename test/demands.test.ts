import { describe, expect, it } from "vitest";
import demandData from "../data/demands.json" with { type: "json" };
import godData from "../data/gods.json" with { type: "json" };
import { demandEnemies, demandPenalty, demandSatisfied, demandSettled, pairKey, parseCondition, resolveDemand, rivals, ruleText, takeSide, type Demand } from "../core/demands";
import { godFoeLines, godLines } from "../ui/shared/header";
import { nextSpokenLine, resetSpokenLines, speak } from "../ui/shared/fx";
import { runSteps, simulateStratified, watchDemand } from "../sim/engine";
import { summarize } from "../sim/report";
import { validateItems } from "../tools/validate";

const demands = demandData as Demand[];
const athena = demands.find(({ id }) => id === "demand_athena_safe")!;
const zeus = demands.find(({ id }) => id === "demand_zeus_swift")!;
describe("demands", () => {
  it("keeps the core rival set equal to data/gods.json", () => {
    // core는 데이터를 읽지 않으므로 이 한 벌만 사본이다. 어긋나면 게이트와 런타임이 다른 게임을 판정한다
    const fromData = new Set(godData.flatMap((god) => god.rivals.map((rival) => pairKey(god.id, rival))));
    expect(rivals).toEqual(fromData);
  });

  /** 신 다섯이 조건을 하나씩 갖는다 — 하나라도 비면 과업 선택지가 한 칸짜리로 선다 */
  it("gives every god exactly one condition", () => {
    expect(demands.map(({ patron }) => patron).sort()).toEqual(godData.map(({ id }) => id).sort());
    expect(godData.flatMap(({ demands: owned }) => owned).sort()).toEqual(demands.map(({ id }) => id).sort());
  });

  /** 비용은 선택 즉시 나가고 보상은 달성 뒤에만 들어온다 */
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

  it("shows an ineligible task as deferred through a boss and consumes it in the next eligible fight", () => {
    const steps = runSteps(4, undefined, ["poseidon", "athena"]);
    let step = steps.next();
    let chooseOnFloorFive = false;
    let chosen = false;
    let deferredAtBoss = false;
    let retainedAfterBoss = false;
    let activeNext = false;
    let cleared = false;
    while (!step.done) {
      const decision = step.value;
      let answer = decision.bot;
      if (decision.phase === "path" && !chosen && decision.observation.floor === 5) {
        const omen = decision.options.find((option) => option.endsWith(":omen"));
        if (omen) {
          answer = omen;
          chooseOnFloorFive = true;
        }
      } else if (decision.phase === "demand" && !chosen) {
        answer = chooseOnFloorFive ? "poseidon" : watchDemand;
        chosen = chooseOnFloorFive;
      }
      if (chosen && decision.phase === "card" && decision.observation.region === "underworld" && decision.observation.floor === 6) {
        deferredAtBoss = decision.observation.promises[0]?.deferred === true && decision.observation.quest?.god === "poseidon";
      }
      if (deferredAtBoss && decision.phase === "reward" && decision.observation.floor === 6) {
        retainedAfterBoss = decision.observation.quest?.god === "poseidon";
      }
      if (retainedAfterBoss && decision.phase === "card" && decision.observation.region === "surface") {
        activeNext = decision.observation.promises.length === 1 && decision.observation.quest?.god === "poseidon";
      }
      if (activeNext && decision.phase === "reward" && decision.observation.region === "surface") {
        cleared = decision.observation.quest === undefined;
        break;
      }
      step = steps.next(answer);
    }
    expect({ chosen, deferredAtBoss, retainedAfterBoss, activeNext, cleared }).toEqual({ chosen: true, deferredAtBoss: true, retainedAfterBoss: true, activeNext: true, cleared: true });
  });

  it("gives base reward first, then +12 favor and three cards from the completed task's god", () => {
    const steps = runSteps(1);
    let step = steps.next();
    let chosen = false;
    let baseFavor: number | undefined;
    let taskReward = false;
    let deckSizeBeforeSkip = 0;
    while (!step.done && !taskReward) {
      const decision = step.value;
      let answer = decision.bot;
      if (decision.phase === "path" && !chosen) answer = decision.options.find((option) => option.endsWith(":omen")) ?? answer;
      else if (decision.phase === "demand") {
        answer = chosen ? watchDemand : "zeus";
        chosen = true;
      }
      if (decision.phase === "reward" && decision.observation.questResult?.settled === "kept") {
        if (!decision.observation.questReward) {
          baseFavor = decision.observation.favor.zeus;
          expect(decision.options).toContain("");
        } else {
          expect(baseFavor).toBeDefined();
          expect(decision.observation.favor.zeus).toBe(baseFavor! + zeus.reward.favor);
          expect(decision.options).toHaveLength(4);
          expect(decision.options).toContain("");
          expect(decision.observation.cards.every(({ id }) => id.startsWith("card_zeus_"))).toBe(true);
          deckSizeBeforeSkip = decision.observation.deck.length;
          answer = "";
          taskReward = true;
        }
      }
      step = steps.next(answer);
    }
    expect(taskReward).toBe(true);
    expect(step.done).toBe(false);
    if (!step.done) expect(step.value.observation.deck).toHaveLength(deckSizeBeforeSkip);
  });

  it("gives no extra reward when the task fails", () => {
    const steps = runSteps(11);
    let step = steps.next();
    let chosen = false;
    let taskRewards = 0;
    let broken = 0;
    while (!step.done) {
      const decision = step.value;
      let answer = decision.bot;
      if (decision.phase === "path" && !chosen) answer = decision.options.find((option) => option.endsWith(":omen")) ?? answer;
      else if (decision.phase === "demand") {
        answer = chosen ? watchDemand : "zeus";
        chosen = true;
      }
      if (decision.phase === "reward" && decision.observation.questReward) taskRewards += 1;
      if (decision.phase === "reward" && decision.observation.questResult?.settled === "broken") broken += 1;
      step = steps.next(answer);
    }
    expect(Object.values(step.value.demandOutcomes)).toEqual([[1, 0]]);
    expect(broken).toBe(1);
    expect(taskRewards).toBe(0);
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
   * 트리거 열에 신 다섯이 다 줄을 갖는다. **게이트가 이미 반려하지만** 화면이 읽는 경로(`godLines`)와
   * 게이트가 세는 경로가 갈릴 수 있다 — 여기서 그 둘을 같은 자리에 세운다. 고르는 것은 나머지 연산이다
   */
  it("말한다 — 트리거 열 × 단계 넷이 다 줄을 갖고 난수를 안 당긴다", () => {
    for (const { id } of godData) {
      for (const trigger of ["demand_offer", "demand_kept", "demand_broken", "tear", "join", "reconcile", "fuse"] as const) {
        expect(godLines(id, trigger, 0)[0]?.trim(), `${id}:${trigger}`).not.toBe("");
      }
      for (const trigger of ["encounter", "intervene", "cross"] as const) {
        for (const stage of ["devotion", "calm", "anger", "wrath"] as const) {
          expect(godLines(id, trigger, 0, stage)[0]?.trim(), `${id}:${trigger}:${stage}`).not.toBe("");
          // 같은 `n`이면 같은 줄이다 — 새 RNG 스트림이 끼면 대사를 켜는 것만으로 replay가 어긋난다
          expect(godLines(id, trigger, 7, stage)).toEqual(godLines(id, trigger, 7, stage));
        }
      }
    }
  });

  it("대사 후보를 결정적으로 돌리고 적은 앞 칸 관계를 고른다", () => {
    const zeus = godData.find(({ id }) => id === "zeus")!.lines.encounter.devotion;
    expect(godLines("zeus", "encounter", 2, "devotion")).toEqual([...zeus.slice(2), ...zeus.slice(0, 2)]);

    const foes = godData.find(({ id }) => id === "athena")!.lines.foes as unknown as Record<string, string[]>;
    expect(godFoeLines("athena", ["enemy_under_zealot", "enemy_surface_support"], 1)[0]).toBe(foes.enemy_under_zealot[1]);
    expect(godFoeLines("athena", ["enemy_under_brute"], 1)).toEqual([]);
    expect(godLines("athena", "encounter", 1, "calm")).toHaveLength(5);
  });

  it("한 런에서 같은 신의 같은 문장을 반복하지 않는다", () => {
    const candidates = ["첫 문장", "다음 문장"];
    resetSpokenLines();
    expect(nextSpokenLine("zeus", candidates)).toBe("첫 문장");
    expect(nextSpokenLine("zeus", candidates)).toBe("다음 문장");
    expect(nextSpokenLine("zeus", candidates)).toBe("");
    expect(nextSpokenLine("poseidon", candidates)).toBe("첫 문장");
    resetSpokenLines();
    expect(nextSpokenLine("zeus", candidates)).toBe("첫 문장");
  });

  it("높은 발화에 막힌 후보는 사용하지 않는다", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelectorAll: () => [{ dataset: { level: "3" } }] } });
    try {
      resetSpokenLines();
      speak(2, "zeus", ["막힌 문장", "다음 문장"]);
      expect(nextSpokenLine("zeus", ["막힌 문장", "다음 문장"])).toBe("막힌 문장");
    } finally {
      if (original) Object.defineProperty(globalThis, "document", original);
      else delete (globalThis as { document?: Document }).document;
      resetSpokenLines();
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

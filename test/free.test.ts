import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import cardData from "../data/cards.json" with { type: "json" };
import achievements from "../data/achievements.json" with { type: "json" };
import { deckOk, deckSize, favorPool, gods, ruleDeck, run, runSteps, startableCards, type PatronPair } from "../sim/engine";
import { readReplay, type ReplayFile } from "../sim/replay";
import { replayPayload } from "../ui/shared/export";

const pairs = gods.flatMap((left, index) => gods.slice(index + 1).map((right) => [left, right] as PatronPair));
const startable = Object.values(startableCards).flat();
const fill = (id: string) => Array.from({ length: deckSize }, () => id);

it("keeps every achievement setup valid", () => {
  expect(new Set(achievements.map(({ id }) => id)).size).toBe(achievements.length);
  expect(new Set(achievements.map(({ name }) => name)).size).toBe(achievements.length);
  expect(new Set(achievements.flatMap(({ pair }) => pair))).toEqual(new Set(gods));
  for (const achievement of achievements) {
    const [left, right] = achievement.pair;
    expect(gods, achievement.id).toContain(left);
    expect(gods, achievement.id).toContain(right);
    expect(right, achievement.id).not.toBe(left);
    expect(achievement.split, achievement.id).toBeGreaterThanOrEqual(0);
    expect(achievement.split, achievement.id).toBeLessThanOrEqual(favorPool);
    expect(achievement.deck, achievement.id).toHaveLength(deckSize);
    const allowed = new Set(achievement.pair.flatMap((god) => startableCards[god as keyof typeof startableCards].map(({ id }) => id)));
    expect(achievement.deck.every((id) => allowed.has(id)), achievement.id).toBe(true);
  }
});

/** 파일은 신뢰 경계다 — `readReplay`를 진짜 파일로 지난다. `deckOk`만 부르면 그 경계를 안 지난다 */
function readWritten(replay: unknown): ReplayFile {
  const dir = mkdtempSync(join(tmpdir(), "god-scales-replay-"));
  const path = join(dir, "run.json");
  try {
    writeFileSync(path, JSON.stringify(replay));
    return readReplay(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 자유 모드는 **아무도 안 재는 코드다** — `tune`도 `sim`도 덱 인자를 안 넘기므로 게이트 밖이다.
 * 그게 목적이지만 크래시까지 면제되는 건 아니다. 이 파일이 유일한 그물이다
 */
describe("free starting deck", () => {
  it("starts every pairing with a hand-built deck", () => {
    // 조합 밖 신의 카드만으로 짠 덱도 서야 한다 — 저울(호의 −5)이 잡는 것이지 코드가 막는 것이 아니다
    const alien = fill(startableCards.artemis[0].id);
    for (const pair of pairs) {
      expect(() => runSteps(1, undefined, pair, fill(startableCards[pair[0]][0].id)).next(), pair.join("+")).not.toThrow();
      expect(() => runSteps(1, undefined, pair, alien).next(), `${pair.join("+")} alien`).not.toThrow();
    }
  });

  it("plays the identical run when handed the deck the rule would have built", () => {
    for (const pair of [pairs[0], pairs[9]]) {
      const { substituted: _a, ...ruled } = run(3, undefined, [], pair);
      const { substituted: _b, ...handed } = run(3, undefined, [], pair, ruleDeck(pair));
      expect(handed, pair.join("+")).toEqual(ruled);
    }
  });

  it("replays a deckless file with the rule deck", () => {
    const actions = run(42).actions.filter(({ type }) => type === "path");
    const old = readWritten({ seed: 42, actions, replay_mode: "action_log" });
    expect(old.deck).toBeUndefined();
    // `run`의 기본값이 규칙 덱이다 — 옛 로그가 그대로 산다
    expect(run(old.seed, undefined, old.actions, old.patrons, old.deck).cardsPlayed)
      .toEqual(run(42, undefined, actions).cardsPlayed);
  });

  it("carries a free deck through export and back into the same run", () => {
    const deck = fill(startableCards.zeus[0].id);
    const played = run(7, undefined, [], ["zeus", "athena"], deck);
    const actions = played.actions.filter(({ type }) => type === "path");
    const file = readWritten(replayPayload(7, actions, ["zeus", "athena"], deck));
    expect(file.deck).toEqual(deck);
    expect(run(file.seed, undefined, file.actions, file.patrons, file.deck).cardsPlayed)
      .toEqual(run(7, undefined, actions, ["zeus", "athena"], deck).cardsPlayed);
    // 규칙 덱과 완전히 같으면 안 적는다 — 편집기를 열었다 닫은 런은 고정 모드로 남는다
    expect(replayPayload(7, actions, ["zeus", "athena"], ruleDeck(["zeus", "athena"])).deck).toBeUndefined();
    expect(replayPayload(7, actions, ["zeus", "athena"]).deck).toBeUndefined();
    // 순서까지 본다 — `createCombat`이 덱 배열을 그대로 섞으므로 자리를 바꾼 덱은 다른 런이다
    expect(replayPayload(7, actions, ["zeus", "athena"], [...ruleDeck(["zeus", "athena"])].reverse()).deck).toBeDefined();
  });

  it("rejects a deck that is the wrong length, unknown, fused, or tier2", () => {
    const good = fill(startableCards.zeus[0].id);
    const fused = cardData.find((card) => "patron_pair" in card)!.id;
    const tier2 = cardData.find((card) => card.tier === 2)!.id;
    const bad: [string, unknown][] = [
      ["짧다", good.slice(1)],
      ["길다", [...good, good[0]]],
      ["모르는 id", [...good.slice(1), "card_nope_99"]],
      ["융합", [...good.slice(1), fused]],
      ["tier2", [...good.slice(1), tier2]],
      ["배열이 아니다", "card_zeus_01"],
    ];
    for (const [label, deck] of bad) {
      expect(() => readWritten({ seed: 1, actions: [], replay_mode: "action_log", deck }), label).toThrow(/Invalid deck/);
    }
    expect(readWritten({ seed: 1, actions: [], replay_mode: "action_log", deck: good }).deck).toEqual(good);
    // 융합·tier2가 애초에 목록에 없다 — 편집기가 고를 수 있는 것은 tier1 patron 카드뿐이다
    expect(startable).toHaveLength(cardData.filter((card) => card.patron && (card.tier ?? 1) === 1).length);
    expect(startable.some(({ id }) => id === fused || id === tier2)).toBe(false);
    expect(deckOk(good)).toBe(true);
  });

  /**
   * 파워 카드는 규칙 덱에 든 적이 없다 — `starterCards`가 attack·defend·utility 태그만 뽑는다.
   * 자유 덱이 `firePowers`가 1층부터 도는 경로를 처음 연다: 크래시가 있으면 여기서 난다
   */
  it("survives a first floor fought with a deck of power cards", () => {
    const powers = startable.filter(({ id }) => cardData.find((card) => card.id === id)!.tags.includes("power"));
    expect(powers.length).toBeGreaterThan(0);
    for (const power of powers) {
      const result = run(5, undefined, [], ["zeus", "athena"], fill(power.id));
      expect(result.encounters, power.id).toBeGreaterThan(0);
    }
  });

  it("observes turn-start power damage in the final frame", () => {
    const steps = runSteps(5, undefined, ["artemis", "athena"], fill("card_artemis_23"));
    let step = steps.next();
    while (!step.done) {
      const next = steps.next(step.value.bot);
      if (!next.done && next.value.phase === "reward" && next.value.observation.finale?.hitSource === "power") {
        expect(next.value.observation.finale.enemies).toEqual([]);
        expect(next.value.observation.finale.hits.length).toBeGreaterThan(0);
        return;
      }
      step = next;
    }
    throw new Error("expected a turn-start power finale");
  });
});

/**
 * 시작 배분은 `deck`과 **같은 자리의 선택 필드**다 — 안 밀면 파일에 안 적히고, 그것이 곧 「배포된
 * replay가 지금 그대로 재생된다」다. `readWritten`이 그 신뢰 경계를 진짜 파일로 지나므로 여기 둔다
 */
describe("starting favor split", () => {
  it("hands the pool to the two patrons and always sums to the pool", () => {
    for (const split of [0, 30, 50, 70, favorPool]) {
      const step = runSteps(1, undefined, ["zeus", "athena"], undefined, split).next();
      if (step.done) throw new Error("expected a decision");
      const { favor } = step.value.observation;
      expect([favor.zeus, favor.athena], `split ${split}`).toEqual([split, favorPool - split]);
    }
  });

  it("replays a splitless file at the even split", () => {
    const actions = run(42).actions.filter(({ type }) => type === "path");
    const old = readWritten({ seed: 42, actions, replay_mode: "action_log" });
    expect(old.split).toBeUndefined();
    // 기본값이 지금 값이다 — 인자를 안 넘긴 런과 50을 넘긴 런이 같은 게임이어야 옛 로그가 그대로 산다
    expect(run(old.seed, undefined, old.actions, old.patrons, old.deck, old.split).favorCurve)
      .toEqual(run(42, undefined, actions, undefined, undefined, favorPool / 2).favorCurve);
  });

  it("carries a pushed split through export and back into the same run", () => {
    const played = run(11, undefined, [], ["zeus", "athena"], undefined, favorPool);
    const actions = played.actions.filter(({ type }) => type === "path");
    const file = readWritten(replayPayload(11, actions, ["zeus", "athena"], undefined, favorPool));
    expect(file.split).toBe(favorPool);
    expect(run(file.seed, undefined, file.actions, file.patrons, file.deck, file.split).favorCurve)
      .toEqual(run(11, undefined, actions, ["zeus", "athena"], undefined, favorPool).favorCurve);
    // 안 민 슬라이더는 파일에 안 적힌다 — 그 런의 반출물은 옛 replay와 같은 모양이다
    expect(replayPayload(11, actions, ["zeus", "athena"], undefined, favorPool / 2).split).toBeUndefined();
    expect(replayPayload(11, actions, ["zeus", "athena"]).split).toBeUndefined();
  });

  it("rejects a split outside the pool", () => {
    // 통과시키면 `shiftFavor`가 조용히 잘라 파일과 다른 런이 된다 — 파일은 신뢰 경계다
    for (const split of [-1, favorPool + 1, 12.5, "50", null]) {
      expect(() => readWritten({ seed: 1, actions: [], replay_mode: "action_log", split }), String(split)).toThrow(/Invalid split/);
    }
    expect(readWritten({ seed: 1, actions: [], replay_mode: "action_log", split: 0 }).split).toBe(0);
  });
});

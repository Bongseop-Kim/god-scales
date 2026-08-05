import { describe, expect, it } from "vitest";
import { trainingEnemy } from "../core/__fixtures__/enemies";
import {
  createCombat,
  drawCards,
  effectiveHp,
  endTurn,
  MAX_HP,
  playCard,
  runCombat,
  startTurn,
  type EnemyDefinition,
} from "../core/combat";
import { createRng } from "../core/rng";
import { addToken, dealDamage, type Card } from "../core/rules";
import type { ActorState, CombatState, GameState } from "../core/state";

/** `startTurn`·`endTurn`이 파워를 발동하려면 `GameState`가 필요하다 — 전투만 있는 테스트는 여기서 감싼다 */
const wrap = (combat: CombatState): GameState => ({ seed: 1, combat, favor: {}, grace: {}, graceSlots: {}, map: { depth: 0, lane: 1, grid: [], completed: [] } });

const strike: Card = {
  id: "strike",
  name: "타격",
  patron: "ares",
  cost: 1,
  target: "enemy",
  effects: [{ op: "damage", value: 6 }],
  tags: ["attack"],
};

describe("combat", () => {
  it("finishes a fixture combat and replays every turn", () => {
    const deck = Array(10).fill("strike");
    const first = runCombat(42, deck, [strike], [trainingEnemy]);
    const second = runCombat(42, deck, [strike], [trainingEnemy]);
    expect(first.state.combat.outcome).toMatch(/victory|defeat/);
    expect(first.snapshots).toEqual(second.snapshots);
  });

  it("clears block but keeps bulwark at turn start", () => {
    const combat = createCombat(1, [], [trainingEnemy]);
    combat.player.block = 4;
    combat.player.tokens.bulwark = 5;
    startTurn(wrap(combat), createRng(1));
    expect([combat.player.block, combat.player.tokens.bulwark, combat.energy]).toEqual([0, 5, 3]);
  });

  it("spends block, then bulwark, then HP", () => {
    const attacker = { id: "enemy", hp: 10, maxHp: 10, block: 0, tokens: {} };
    const target = { id: "player", hp: 10, maxHp: 10, block: 2, tokens: { bulwark: 3 } };
    dealDamage(attacker, target, 6);
    expect([target.block, target.tokens.bulwark, target.hp]).toEqual([0, undefined, 9]);
  });

  it("reshuffles discard, stops on empty piles, and respects the hand limit", () => {
    const combat = createCombat(1, [], [trainingEnemy]);
    combat.discardPile = ["a", "b"];
    drawCards(combat, 2, createRng(2));
    expect(combat.hand.sort()).toEqual(["a", "b"]);
    drawCards(combat, 5, createRng(2));
    expect(combat.hand).toHaveLength(2);

    combat.drawPile = ["kept"];
    combat.hand = Array(10).fill("full");
    drawCards(combat, 1, createRng(2));
    expect(combat.drawPile).toEqual(["kept"]);
  });

  it("removes exhausted cards for the rest of combat", () => {
    const exhaust = { ...strike, id: "exhaust", tags: ["attack", "exhaust"] as Card["tags"] };
    const result = runCombat(2, ["exhaust", ...Array(9).fill("strike")], [strike, exhaust], [trainingEnemy]);
    expect(result.state.combat.drawPile).not.toContain("exhaust");
    expect(result.state.combat.discardPile).not.toContain("exhaust");
    expect(result.state.combat.hand).not.toContain("exhaust");
  });

  it("times out after 50 turns", () => {
    const wall: EnemyDefinition = { id: "wall", hp: 999, pattern: [{ block: 1 }] };
    const result = runCombat(3, Array(10).fill("strike"), [{ ...strike, effects: [] }], [wall]);
    expect([result.state.combat.turn, result.state.combat.outcome, result.state.combat.timeout]).toEqual([51, "timeout", true]);
  });

  it("counts bulwark as effective HP", () => {
    const enemy = createCombat(1, [], [{ ...trainingEnemy, bulwark: 7 }]).enemies[0];
    expect(effectiveHp(enemy)).toBe(37);
  });
});

describe("enemy passives", () => {
  const idle: EnemyDefinition = { id: "idle", hp: 50, pattern: [{ block: 1 }] };
  const definitions = (...enemies: EnemyDefinition[]) => new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const gameState = (enemies: EnemyDefinition[], hand: string[]): GameState => {
    const combat = createCombat(1, [], enemies);
    combat.hand = hand;
    combat.energy = 9;
    return wrap(combat);
  };

  it("caps the HP lost in one turn and resets the cap at end of turn", () => {
    const shelled = { ...idle, passives: { shell: 8 } };
    const combat = createCombat(1, [], [shelled]);
    dealDamage(combat.player, combat.enemies[0], 30);
    expect(combat.enemies[0].hp).toBe(42);
    dealDamage(combat.player, combat.enemies[0], 30);
    expect(combat.enemies[0].hp, "같은 턴에는 더 잃지 않는다").toBe(42);
    endTurn(wrap(combat), definitions(shelled));
    dealDamage(combat.player, combat.enemies[0], 30);
    expect(combat.enemies[0].hp, "한 바퀴 뒤에 다시 8만큼 열린다").toBe(34);
  });

  it("does not count a reflected hit — curl and angry stay asleep", () => {
    const reactive = { ...idle, passives: { curl: 5, angry: 2 } };
    const combat = createCombat(1, [], [reactive]);
    combat.enemies[0].tokens.deflect = 1;
    dealDamage(combat.player, combat.enemies[0], 9);
    expect([combat.enemies[0].block, combat.enemies[0].tokens.frenzy]).toEqual([0, undefined]);
    dealDamage(combat.player, combat.enemies[0], 9);
    expect([combat.enemies[0].block, combat.enemies[0].tokens.frenzy]).toEqual([5, 2]);
  });

  it("wards a harmful token and cancels frenzy against soaked", () => {
    const actor: ActorState = { id: "a", hp: 10, maxHp: 10, block: 0, tokens: {}, passives: { ward: 1 } };
    addToken(actor, "bleed", 1);
    expect(actor.tokens.bleed, "결계가 하나를 먹는다").toBeUndefined();
    addToken(actor, "bleed", 1);
    expect(actor.tokens.bleed, "다 쓴 결계는 통과시킨다").toBe(1);
    addToken(actor, "frenzy", 5);
    expect(actor.tokens.frenzy, "상한이 없다 — 광란은 소모로만 줄어든다").toBe(5);
    addToken(actor, "soaked", 2);
    expect([actor.tokens.frenzy, actor.tokens.soaked], "침수가 광란을 스택만큼 지운다").toEqual([3, undefined]);
  });

  it("redirects one hit to the guard and never bounces it back", () => {
    // 둘이 서로를 지킨다 — 재지정이 순환하면 이 테스트가 끝나지 않는다
    const first = { ...idle, id: "first", hp: 30, passives: { guard: 1 } };
    const second = { ...idle, id: "second", hp: 30, passives: { guard: 1 } };
    const state = gameState([first, second], [strike.id]);
    playCard(state, new Map([[strike.id, strike]]), strike.id, "first");
    expect(state.combat.enemies.map(({ hp }) => hp)).toEqual([30, 24]);
  });

  it("pours ramp, rally, and spite into frenzy", () => {
    const ramping = { ...idle, id: "ramping", passives: { ramp: 1 } };
    const rallying = { ...idle, id: "rallying", passives: { rally: 2, spite: 1 } };
    const defend: Card = { id: "defend", name: "방어", cost: 1, target: "self", effects: [{ op: "block", value: 5 }], tags: ["defend"] };
    const state = gameState([ramping, rallying], [defend.id, defend.id]);
    playCard(state, new Map([[defend.id, defend]]), defend.id);
    expect(state.combat.enemies[1].tokens.frenzy, "비공격 카드가 앙심을 깨운다").toBe(1);
    endTurn(state, definitions(ramping, rallying));
    expect(state.combat.enemies[0].tokens.frenzy, "고조는 매 턴 쌓인다").toBe(1);
    state.combat.enemies[0].hp = 0;
    state.combat.hand.push(defend.id);
    playCard(state, new Map([[defend.id, defend]]), defend.id);
    expect(state.combat.enemies[1].tokens.frenzy, "앙심 1 + 규합 2가 그대로 더해진다").toBe(4);
  });

  it("reflects thorns even through full block and wakes angry, without ping-ponging", () => {
    // 가시가 `amount > 0` 안에 있으면 방어를 쌓는 아테나가 자기 가시를 지운다 — 그래서 방어 밖이다.
    // 되돌린 피해는 실제로 hp를 깎으므로 angry를 깨우고, 반사 순환은 가시가 한쪽에만 붙어 끝난다
    const reactive = { ...idle, passives: { angry: 1 } };
    const combat = createCombat(1, [], [reactive]);
    combat.player.block = 99;
    combat.player.tokens.thorns = 3;
    dealDamage(combat.enemies[0], combat.player, 5);
    expect([combat.player.hp, combat.player.block], "방어가 다 막아도 가시는 터진다").toEqual([MAX_HP, 94]);
    expect([combat.enemies[0].hp, combat.enemies[0].tokens.frenzy], "가시가 angry를 깨운다").toEqual([47, 1]);
    expect(combat.player.tokens.thorns, "가시는 소모되지 않는다").toBe(3);
  });

  it("wakes angry before the thorns bounce, so the bounce spends that frenzy", () => {
    // 한 배우가 angry와 thorns를 다 들면 순서가 눈에 보인다. 주 피해가 광란을 주고 **그 뒤에** 터지는
    // 반사가 그 광란을 소모해 3 + 2로 나간다. 반사를 앞에 두면 때린 쪽이 그 광란을 먹는다
    const spiky = { ...idle, passives: { angry: 1 } };
    const combat = createCombat(1, [], [spiky]);
    combat.enemies[0].tokens.thorns = 3;
    dealDamage(combat.player, combat.enemies[0], 6);
    expect(combat.enemies[0].hp, "주 피해 6").toBe(44);
    expect(combat.enemies[0].tokens.frenzy, "반사가 방금 깨운 광란을 썼다").toBeUndefined();
    expect(combat.player.hp, "가시 3 + 광란 2").toBe(MAX_HP - 5);
  });

  it("sends ally actions to another enemy and never to the player", () => {
    const healer: EnemyDefinition = { id: "healer", hp: 30, pattern: [{ heal: 4, target: "ally" }] };
    const wounded = { ...idle, id: "wounded" };
    const combat = createCombat(1, [], [healer, wounded]);
    combat.enemies[1].hp = 10;
    endTurn(wrap(combat), definitions(healer, wounded));
    expect(combat.enemies[1].hp).toBe(14);
    expect(combat.player.hp, "플레이어는 적의 회복을 받지 않는다").toBe(MAX_HP);
  });
});

describe("powers", () => {
  const idle: EnemyDefinition = { id: "idle", hp: 50, pattern: [{ damage: 4 }] };
  const definitions = new Map([[idle.id, idle]]);
  /** 트리거 넷을 한 장씩. 전부 `apply_token`이라 어느 훅이 언제 돌았는지 스택 수로 읽힌다 */
  const power = (trigger: NonNullable<Card["trigger"]>, token: "bulwark" | "crit"): Card =>
    ({ id: trigger, name: trigger, patron: "athena", cost: 0, target: "self", trigger, effects: [{ op: "apply_token", token, stacks: 1 }], tags: ["power", "token"] });

  it("registers instead of firing, then fires on each of the four hooks", () => {
    const cards = new Map<string, Card>([
      ...(["turn_start", "turn_end", "on_play"] as const).map((trigger) => [trigger, power(trigger, "bulwark")] as const),
      ["on_unblocked", { ...power("on_unblocked", "crit"), target: "enemy" as const, effects: [{ op: "apply_token" as const, token: "bleed" as const, stacks: 1 }] }],
      [strike.id, strike],
    ]);
    const combat = createCombat(1, [], [idle]);
    combat.energy = 9;
    const state = wrap(combat);

    combat.hand = ["turn_start"];
    playCard(state, cards, "turn_start");
    expect(combat.powers).toHaveLength(1);
    expect(combat.player.tokens.bulwark, "등록만 한다 — 낸 그 자리에서 일하지 않는다").toBeUndefined();

    startTurn(state, createRng(1));
    expect(combat.player.tokens.bulwark, "턴 시작에 발동한다").toBe(1);

    combat.hand = ["turn_end", "on_play", "on_unblocked", strike.id];
    playCard(state, cards, "turn_end");
    playCard(state, cards, "on_play");
    // on_play는 등록한 그 카드도 센다 — 이후 어떤 카드를 내도 매번 돈다
    expect(combat.player.tokens.bulwark, "on_play가 자기 등록 턴부터 돈다").toBe(2);
    playCard(state, cards, "on_unblocked");
    expect(combat.player.tokens.bulwark).toBe(3);

    playCard(state, cards, strike.id, idle.id);
    expect(combat.enemies[0].tokens.bleed, "무방비 피해가 통했을 때만 터진다").toBe(1);
    expect(combat.player.tokens.bulwark, "카드 한 장에 on_play 한 번").toBe(4);

    // 턴 끝은 적이 치기 **전에** 돈다: 방벽 5가 서고 적 피해 4를 다 먹어 1이 남는다.
    // 적 뒤에 돌면 방벽 5가 그대로 남고 체력이 4 깎여 [5, 96]이 된다 — 그것이 이 단언이 가르는 것이다
    endTurn(state, definitions);
    expect([combat.player.tokens.bulwark, combat.player.hp]).toEqual([1, MAX_HP]);
  });

  it("stacks a power played twice and never fires a power off its own damage", () => {
    const bite: Card = { id: "bite", name: "물기", patron: "ares", cost: 0, target: "enemy", trigger: "on_unblocked", effects: [{ op: "damage", value: 2 }], tags: ["power"] };
    const cards = new Map<string, Card>([[bite.id, bite], [strike.id, strike]]);
    const combat = createCombat(1, [], [idle]);
    combat.energy = 9;
    combat.hand = [bite.id, bite.id, strike.id];
    const state = wrap(combat);

    playCard(state, cards, bite.id, idle.id);
    playCard(state, cards, bite.id, idle.id);
    expect(combat.powers, "상한은 없다 — 두 장 넣은 것 자체가 비용이다").toHaveLength(2);
    // 타격 6 + 파워 둘의 2 + 2. 파워가 낸 피해로 파워가 또 돌면 여기서 끝나지 않는다
    playCard(state, cards, strike.id, idle.id);
    expect(combat.enemies[0].hp).toBe(40);
  });
});

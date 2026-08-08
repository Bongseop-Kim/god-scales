import { AnimatePresence, m, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import type { CSSProperties, Ref } from "react";
import { MAX_SLOTS, type EnemyAction } from "../core/combat.ts";
import { favorBoundaries, favorInitial, favorStage, godEnemyId, intervenesOnTurn, interventionEveryTurns, type FavorStage, type StageEffect } from "../core/favor.ts";
import { floorsPerRegion } from "../core/map.ts";
import type { PassiveName, Trigger } from "../core/state.ts";
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import { endTurnAction, type CardView, type CombatDecision, type CombatObservation, type PromiseView } from "../sim/engine.ts";
import { tagParticle } from "./art-keys.ts";
import { Backdrop, backdropArt } from "./backdrop.tsx";
import { cardTagOf, effectText, GameCard } from "./card.tsx";
import { playSprite, speak } from "./fx.ts";
import { godArt, godLine, godName, godStageEffects, godStageText, stageName, RunHeader } from "./header.tsx";
import { Icon, type IconName } from "./icon.tsx";
import { tokenName, tokenSummary, TokenRow } from "./tokens.tsx";

const spriteArt = import.meta.glob<string>("../art/sprites/*.webp", { eager: true, query: "?url", import: "default" });
const fxArt = import.meta.glob<string>("../art/fx/*.webp", { eager: true, query: "?url", import: "default" });
const particleArt = import.meta.glob<string>("../art/particle/*.webp", { eager: true, query: "?url", import: "default" });
/**
 * 개입 op → 파티클 한 장. **카드가 쓰는 넷과 같은 파일이다**(`tagParticle`) — 개입마다 새로 그리지
 * 않는다. 카드와 갈리는 것은 그림이 아니라 자리다: 신의 것은 `strike`가 위에서 내려온다
 */
const opParticle: Record<string, string> = { damage: "slash_01", block: "window_01", heal: "magic_01", apply_token: "magic_01" };

type EnemyInfo = { id: string; name: string; intent_visible: boolean };
const enemyInfo = new Map((enemyDataJson as EnemyInfo[]).map((enemy) => [enemy.id, enemy]));
/** 배지에 그대로 나가는 이름. 표가 `PassiveName`을 다 덮으므로 패시브를 새로 만들면 여기서 컴파일이 막힌다 */
const passiveLabels: Record<PassiveName, string> = {
  guard: "보호", shell: "경화", ward: "결계", curl: "웅크림",
  angry: "분노", rally: "규합", ramp: "고조", spite: "앙심",
};
const pop = { duration: 0.16, ease: [0.23, 1, 0.32, 1] } as const;
/** 적이 사라지는 180ms. 셋이 둘이 되는 순간에 화면이 덜컥 올라오면 고장으로 읽힌다 */
const exitPop = { duration: 0.18, ease: [0.23, 1, 0.32, 1] } as const;
/** 손 → 무대 200ms. 들어오는 것이라 `--ease-out`과 같은 곡선이다 */
const stageIn = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;
const damagePop = { duration: 0.4, ease: [0.23, 1, 0.32, 1] } as const;

/** A-2.6 팝 400ms. hitSeq를 key로 써서 같은 피해가 두 번 튀지 않고, 새 피해는 다시 튄다 */
function DamagePop({ hits, id, seq, still }: { hits: CombatObservation["hits"]; id: string; seq: number; still: boolean }) {
  const amount = hits.find((hit) => hit.id === id)?.amount;
  if (!amount) return null;
  return still
    ? <span className="damage-pop" aria-hidden="true">-{amount}</span>
    : (
      <m.span
        key={seq}
        className="damage-pop"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.7, y: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.15, 1, 1], y: [0, -10, -16, -22] }}
        transition={damagePop}
      >
        -{amount}
      </m.span>
    );
}

/**
 * 복합 행동을 하나로 뭉개지 않는다 — 「공격 12 + 방어 8」을 `"대기"`로 적으면 대상 선택이 도박이 된다.
 * 아군을 향하는 행동은 누구에게 가는지까지 적는다: 회복이 자기 것인지 옆 것인지가 처치 순서를 바꾼다
 */
function intentLabel(action?: EnemyAction): string {
  const side = action?.target === "ally" ? "아군 " : action?.target === "all_allies" ? "적 전체 " : "";
  const parts = [
    action?.damage && `공격 ${action.damage}`,
    action?.block && `${side}방어 ${action.block}`,
    action?.heal && `${side}회복 ${action.heal}`,
    // 토큰은 한글 이름으로 적는다 — 배지가 「감전」인데 의도가 `shock`이면 같은 것이 두 이름을 갖는다
    action?.token && `${side}${tokenName(action.token)} ${action.stacks ?? 1}`,
    // 판 밖으로 나간다 — 「누구의」를 안 적는다: 후원 신 둘 다 같은 값만큼 내려간다
    action?.favor && `호의 ${action.favor}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : "대기";
}

/**
 * 의도 아이콘은 **맨 앞 하나**다. 복합 행동은 `intentLabel`이 이미 「공격 9 + 침수 1」로 다 적으므로
 * 조각마다 아이콘을 붙이면 16px 넷이 한 줄에서 문장을 밀어낸다 — 순서는 `intentLabel`의 조각 순서와 같다.
 * 의도를 감추는 적은 `omen`을 쓴다: 지도의 「무엇인지는 들어가야 압니다」와 같은 뜻이다
 */
const intentIcon = (action?: EnemyAction): IconName =>
  action?.damage ? "damage" : action?.block ? "block" : action?.heal ? "heal" : action?.token ? "token" : action?.favor ? "favor" : "idle";

/** 칸 넷. **0이 앞**(병사와 가까운 쪽)이고 3이 뒤다 */
const slots = Array.from({ length: MAX_SLOTS }, (_, slot) => slot);
/**
 * 칸 이름. 그림에서는 위아래 순서가 앞뒤를 말하지만 **스크린 리더에는 순서가 없다** — 그래서
 * 배지가 아니라 `aria-label`이 칸 번호를 들고, 양 끝만 앞·뒤를 덧붙인다
 */
const slotLabel = (slot: number, span = 1) =>
  `칸 ${span > 1 ? `${slot}~${slot + span - 1}` : slot}${slot === 0 ? " 앞" : slot + span - 1 === MAX_SLOTS - 1 ? " 뒤" : ""}`;

/**
 * 손패에는 같은 카드가 두 장 있다. 키를 `id-index`로 쓰면 한 장이 무대로 빠질 때 **뒤 카드의 인덱스가
 * 밀려 키가 전부 바뀌고** 남은 카드가 통째로 퇴장·재등장한다. 몇 번째 사본인지로 세면 빠진 자리만 닫힌다
 */
const handKeys = (hand: CardView[]): string[] =>
  hand.map(({ id }, index) => `${id}#${hand.slice(0, index).filter((card) => card.id === id).length}`);

export function CombatScreen({ seed, decision, onAnswer }: {
  seed: number;
  decision: CombatDecision;
  onAnswer: (choice: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const { phase, options, observation: view } = decision;
  const targeting = phase === "target";
  const transition = reducedMotion ? { duration: 0 } : pop;
  const enemySide = useRef<HTMLDivElement>(null);
  const playerSide = useRef<HTMLDivElement>(null);

  /** 개입이 때린/붙인 대상의 판. 카드 파티클이 쓰는 두 패널과 같은 자리, 한 칸 더 좁을 뿐이다 */
  const hostsFor = (target: StageEffect["target"]): HTMLElement[] => {
    if (target === "self") return playerSide.current ? [playerSide.current] : [];
    // `targets()`와 같은 규칙 — `enemy`는 앞의 산 적 하나다(`core/favor.ts`)
    const aimed = target === "enemy" ? view.enemies.slice(0, 1) : view.enemies;
    return aimed.flatMap(({ id }) => {
      const node = enemySide.current?.querySelector<HTMLElement>(`[data-enemy="${id}"]`);
      return node ? [node] : [];
    });
  };

  /**
   * 조우 시작(1턴)과 개입 턴(2·5·8턴, `intervenesOnTurn`)에 컷인이 뜬다. 그 두 자리가 신이 실제로
   * 판을 흔드는 자리다(`core/favor.ts`의 `on_encounter_start`·`on_turn_start`) — 화면에 아무 표시가
   * 없으면 체력이 왜 깎였는지 플레이어가 모른다.
   *
   * **데이터가 있는 신만 선다.** 「조우 시작에는 극단 둘만」이던 옛 규칙은 평온이 그 자리에서 아무것도
   * 안 하던 시절의 것이다(P-46 §5가 채웠다) — 빈 문장이 곧 「이 신은 지금 아무 일도 안 한다」다.
   * 겹침은 큐가 아니라 **순서**로 푼다: 신 하나씩 220ms 어긋난다
   */
  useEffect(() => {
    const start = view.turn === 1;
    if (!start && !intervenesOnTurn(view.turn)) return;
    const hook = start ? "on_encounter_start" : "on_turn_start";
    const timers = view.patrons.map((god, index) => {
      const stage = favorStage(view.favor[god] ?? favorInitial);
      const text = godStageText(god, stage)[start ? "start" : "turn"];
      return setTimeout(() => {
        /**
         * **말은 판을 안 흔들어도 나온다** — 컷인은 「무엇을 했는가」라 데이터가 없으면 빈 문장이지만,
         * 아무것도 안 하는 단계에도 신은 말한다. 조우 시작은 말(L2)이고 개입 턴은 자막(L1)이다:
         * 런당 49회 뜨는 자리를 화면 중앙에 2초씩 세우면 전투가 아니라 낭독이 된다
         */
        speak(start ? 2 : 1, god, godLine(god, start ? "encounter" : "intervene", start ? view.depth : view.turn, stage));
        const effects = godStageEffects(god, stage, hook);
        // 「신이 적으로 합류」는 판이 뒤집히는 사건이라 480ms 페이드로 지나가면 안 된다 — 신 일러가 선다
        const joinEffect = effects.find(({ op }) => op === "join");
        const source = joinEffect ? godArt[`../art/gods/${god}.webp`] : fxArt[`../art/fx/${stage}.webp`];
        if (text && source) void playSprite(document.body, source, "cut", { god, stage, text: `${godName(god)} · ${stageName[stage]} — ${text}` });
        /**
         * 합류는 외침(L3)이다. **컷인이 끝난 뒤**에 낸다 — 같이 내면 L3의 어두운 배경이 「무엇을
         * 했는가」를 덮어 버린다. 신을 버려 놓고 그 신이 판 건너편에 서는 순간이라 스치면 안 된다
         */
        if (joinEffect) {
          const joined = joinEffect.god ?? god;
          setTimeout(() => speak(3, joined, godLine(joined, "join", view.depth), godArt[`../art/gods/${joined}.webp`]), 480);
        }
        if (reducedMotion) return;
        // 피해 개입은 화면이 흔들린다. 진노만 크게 — `.fx`와 같은 WAAPI라 새 의존이 없다
        if (effects.some(({ op }) => op === "damage")) {
          const shift = stage === "wrath" ? 10 : 4;
          document.body.animate([{ transform: `translateX(-${shift}px)` }, { transform: `translateX(${shift}px)` }, { transform: "none" }], { duration: 200, easing: "ease-in-out" });
        }
        for (const effect of effects) {
          const sprite = particleArt[`../art/particle/${opParticle[effect.op]}.webp`];
          for (const host of hostsFor(effect.target)) {
            // 카드 파티클은 제자리에서 터지고 신의 것은 위에서 내려온다 — 한눈에 갈린다
            if (effect.op === "damage" || effect.op === "block") void playSprite(host, fxArt["../art/fx/strike.webp"], "spark");
            if (sprite) void playSprite(host, sprite, "spark");
          }
        }
      }, index * 220);
    });
    return () => { for (const timer of timers) clearTimeout(timer); };
  }, [view.turn]);

  /**
   * 클릭은 언제나 「손 → 무대」 하나다. 즉발은 무대에 머무는 시간이 0인 경우고, 대상을 고르는 카드는
   * 무대에서 기다린다 — **UI가 어느 쪽인지 예측하지 않는다**(두 분기는 `card.target`과 사거리 안 적
   * 수로만 갈린다). 낸 카드를 들고 있다가 엔진이 target 단계를 지나 보내면 그때가 발동이다
   */
  const played = useRef<CardView>(null);
  const play = (choice: string) => {
    played.current = view.hand.find(({ id }) => id === choice) ?? played.current;
    onAnswer(choice);
  };
  /** 카드가 발동한 자리에 태그 파티클 한 장. 자기 대상이면 내 쪽, 아니면 적 쪽에서 튄다 */
  useEffect(() => {
    const card = played.current;
    if (!card || targeting) return;
    played.current = null;
    const source = particleArt[`../art/particle/${tagParticle[cardTagOf(card.id) ?? ""]}.webp`];
    const host = (card.target === "self" ? playerSide : enemySide).current;
    if (source && host && !reducedMotion) void playSprite(host, source, "spark");
  }, [decision]);

  /**
   * 확정·찢기·화해 셋은 **한 번만** 말한다. 셋 다 관측이 실어 온 사실을 보고 갈리므로 화면이 규칙을
   * 다시 계산하지 않는다 — 본 것을 `useRef` 한 벌에 적어 두고 새것만 낸다. 키에 `depth`가 든 이유는
   * 조우가 바뀌면 같은 약속·같은 seq가 다시 서기 때문이다
   */
  const spoken = useRef(new Set<string>());
  const godsOnBoard = useRef<string[]>([]);
  useEffect(() => {
    const once = (key: string, say: () => void) => {
      if (spoken.current.has(key)) return;
      spoken.current.add(key);
      say();
    };
    // 확정은 `settled`가 처음 생기는 프레임이 그 자리고, 그 뒤로는 값이 안 바뀐다(사실이 단조다)
    for (const { god, rule, settled } of view.promises) {
      if (!settled) continue;
      once(`${view.depth}:kept:${god}:${rule}`, () =>
        speak(2, god, godLine(god, settled === "kept" ? "demand_kept" : "demand_broken", view.turn)));
    }
    // 찢기는 이 게임에서 가장 말이 필요한 자리다 — 신을 버려 놓고 그 신의 번개를 쓴 순간이다
    if (view.torn) {
      const { god, seq } = view.torn;
      once(`${view.depth}:torn:${seq}`, () => speak(3, god, godLine(god, "tear", seq), godArt[`../art/gods/${god}.webp`]));
    }
    /**
     * 화해 — 진노로 합류한 신이 판에서 사라지는 순간이다. 호의를 평온 하한으로 돌리는 것은 조우가
     * **이긴 채로** 끝난 뒤라(`sim/engine.ts`의 `felled`) 여기서 말하는 것이 엔진보다 조금 이르다:
     * 이 뒤에 지면 화해는 없다. 그래도 사람이 보는 사건은 신이 쓰러지는 이 프레임이다
     */
    const onBoard = view.enemies.map(({ id }) => id).filter((id) => view.patrons.some((god) => godEnemyId(god) === id));
    for (const gone of godsOnBoard.current.filter((id) => !onBoard.includes(id))) {
      const god = view.patrons.find((patron) => godEnemyId(patron) === gone)!;
      once(`${view.depth}:felled:${god}`, () => speak(3, god, godLine(god, "reconcile", view.depth), godArt[`../art/gods/${god}.webp`]));
    }
    godsOnBoard.current = onBoard;
  }, [decision]);

  // 무대에 선 카드는 손패에서 빠진다 — 엔진은 target을 받은 뒤에 카드를 버리므로 아직 `hand`에 있다
  const staged = targeting ? view.hand.findIndex(({ id }) => id === view.card) : -1;
  const keys = handKeys(view.hand);
  const fan = view.hand.map((card, index) => ({ card, key: keys[index] })).filter((_, index) => index !== staged);

  return (
    <>
      <Backdrop src={backdropArt(view.region, view.floor === floorsPerRegion ? "boss" : "combat")} region={view.region} seed={seed + view.depth} />
      <div className="shell run-layout combat-layout">
      <RunHeader seed={seed} view={view} title="전투" badge={`${view.turn}턴`} />
      <PromiseRow promises={view.promises} />

      <div className="enemy-panel" ref={enemySide}>
        <h2>적</h2>
        {/* 칸 넷을 언제나 그린다 — **빈 칸도 자리를 지킨다.** 남은 적이 앞뒤 어디였는지가 사거리의 근거다 */}
        {/* `popLayout`이 퇴장 중인 적을 흐름에서 뺀다 — 안 빼면 빈 칸 자리가 나란히 서서 패널이 늘었다 준다 */}
        <AnimatePresence initial={false} mode="popLayout">
          {slots.map((slot) => {
            const enemy = view.enemies.find((candidate) => candidate.slot === slot);
            // 두 칸짜리가 덮은 칸. 자리표시를 그리면 판이 다섯 칸이 된다
            const covered = view.enemies.some((candidate) => candidate.slot < slot && candidate.slot + candidate.span > slot);
            if (covered) return null;
            // 빈 칸은 스크린 리더에서 감춘다 — 산 적의 라벨이 칸 번호를 들고 있어 앞뒤는 그것으로 읽힌다
            if (!enemy) return <p key={slot} className="enemy empty" aria-hidden="true">{slotLabel(slot)}</p>;
            return (
              /**
               * **키가 칸이 아니라 적이다** — 밀림이 앞뒤를 맞바꾸면 React가 노드를 옮기고 `layout`이
               * 그 사이를 미끄러진다. 칸을 키로 쓰면 자리에 있던 노드의 내용만 바뀌어 플레이어는
               * 「적이 바뀐 줄」 안다. 줄인 모션에서는 즉시 이동한다
               */
              <EnemyButton
                key={enemy.id}
                enemy={enemy}
                slot={slot}
                hits={view.hits}
                hitSeq={view.hitSeq}
                enabled={targeting && options.includes(enemy.id)}
                reducedMotion={!!reducedMotion}
                onSelect={() => onAnswer(enemy.id)}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="decision-panel" ref={playerSide}>
        <PlayerActor view={view} reducedMotion={!!reducedMotion} />
        {/* 무대가 어느 카드인지 말하므로 힌트는 무엇을 할지만 말한다 — `view.card`는 id라 문장에 못 넣는다 */}
        <p className="hint" role="status">{targeting ? "대상을 고르세요" : "낼 카드를 고르세요"}</p>
        {staged >= 0 && (
          /**
           * 무대. **맥동·발광 루프를 넣지 않는다** — 사람이 적을 고르는 내내 시야에서 움직인다.
           * 정지가 「너를 기다린다」다. 줄인 모션에서는 자리만 남고 들어오는 이동이 없다
           */
          <m.div
            key={view.card}
            className="stage"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : stageIn}
          >
            <GameCard cardId={view.hand[staged].id} card={view.hand[staged]} />
          </m.div>
        )}
        {/**
         * 부채꼴. **바깥 래퍼가 자세(회전)를 들고 안쪽 카드가 모션(hover 리프트)을 든다** — 한 겹으로
         * 짜면 `prefers-reduced-motion`의 `transform: none` 한 줄이 부채꼴을 통째로 편다. 각도는
         * 모션이 아니라 배치다. 기하는 전부 CSS고 React는 `--i`·`--n`만 넣는다
         */}
        <div className={`fan${targeting ? " aiming" : ""}`} style={{ "--n": fan.length } as CSSProperties}>
          <AnimatePresence initial={false}>
            {fan.map(({ card, key }, index) => (
              <FanCard
                key={key}
                card={card}
                index={index}
                transition={transition}
                disabled={targeting || !options.includes(card.id)}
                onSelect={() => play(card.id)}
              />
            ))}
          </AnimatePresence>
        </div>
        <button className="primary" type="button" disabled={targeting} onClick={() => onAnswer(endTurnAction)}>턴 종료</button>
      </div>
      </div>
    </>
  );
}

/**
 * 부채꼴 한 자리. **바깥 래퍼는 자세만 든다** — 회전·겹침·`z-index`는 CSS가 `--i`·`--n`으로 풀고
 * 여기서는 등장·퇴장만 흐린다. `transform`을 건드리지 않는 것이 두 겹을 나눈 값이다.
 *
 * **낸 카드는 160ms 동안 DOM에 남는다** — 마지막 렌더의 props를 들고 있어 그동안 눌린다. 사람이
 * 흐려지는 카드를 눌러도 아무 일이 안 일어나고, e2e 드라이버는 그것을 첫 후보로 골라 1초 헛돈다
 * (실측 78회 × 1초). 사라지는 중이면 누를 수 없다 — 적 버튼과 같은 이유, 같은 한 줄이다
 */
function FanCard({ card, index, transition, disabled, onSelect }: {
  card: CardView;
  index: number;
  transition: { duration: number };
  disabled: boolean;
  onSelect: () => void;
}) {
  const present = useIsPresent();
  return (
    <m.div
      style={{ "--i": index } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      <GameCard cardId={card.id} card={card} disabled={disabled || !present} onSelect={onSelect} />
    </m.div>
  );
}

/**
 * 적 하나. **컴포넌트로 나눈 이유는 `useIsPresent()` 하나다** — 퇴장 애니메이션 중인 버튼은 마지막
 * 렌더의 props를 그대로 들고 있어서, 대상 선택 중에 죽은 적은 180ms 동안 `disabled`가 아닌 채로 DOM에
 * 남는다. e2e 드라이버(`tools/e2e.ts:52`)는 `!el.disabled`만 보므로 **죽은 적을 고르고** 1초 헛돈다
 */
function EnemyButton({ enemy, slot, hits, hitSeq, enabled, reducedMotion, onSelect, ref }: {
  enemy: CombatObservation["enemies"][number];
  slot: number;
  hits: CombatObservation["hits"];
  hitSeq: number;
  enabled: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
  /**
   * `mode="popLayout"`이 `cloneElement(child, { ref })`로 노드를 재서 흐름에서 뺀다 — **받아서 넘기지
   * 않으면 조용히 아무 일도 안 일어난다.** 그러면 퇴장 중인 적이 빈 칸과 나란히 서서 패널이 늘었다 준다
   */
  ref?: Ref<HTMLButtonElement>;
}) {
  const present = useIsPresent();
  const sprite = spriteArt[`../art/sprites/${enemy.id}.webp`];
  const info = enemyInfo.get(enemy.id);
  const name = info?.name ?? enemy.id;
  const hidden = info?.intent_visible === false;
  const intent = hidden ? "의도 감춤" : intentLabel(enemy.intent);
  const passives = Object.entries(enemy.passives) as [PassiveName, number][];
  return (
    <m.button
      ref={ref}
      layout={!reducedMotion}
      transition={reducedMotion ? { duration: 0 } : pop}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, transition: exitPop }}
      className={enemy.span > 1 ? "enemy wide" : "enemy"}
      // 개입 파티클이 맞은 판을 여기서 찾는다 — 적마다 ref를 하나 더 다는 대신이다(`popLayout`이 ref를 이미 쓴다)
      data-enemy={enemy.id}
      // 두 칸을 차지한 적은 두 칸 높이로 선다 — 인라인인 이유는 폭이 데이터라서다(`EnemyView.span`)
      style={enemy.span > 1 ? { gridRow: `span ${enemy.span}` } : undefined}
      type="button"
      disabled={!enabled || !present}
      onClick={onSelect}
      // 배지마다 읽히면 적 하나가 문장 여섯이 된다 — 버튼 하나에 요약 한 문장이다
      aria-label={`${slotLabel(slot, enemy.span)} ${name} 체력 ${enemy.hp} ${intent} ${passives.map(([id, stacks]) => `${passiveLabels[id]} ${stacks}`).join(" ")} ${tokenSummary(enemy.tokens)}`}
    >
      {/* 스프라이트는 이름 **위** 한 줄이다 — 옆에 세우면 405px 칸에서 의도 한 줄(nowrap)이 넘친다 */}
      {sprite && <span className="sprite"><img src={sprite} alt="" /></span>}
      {/* 토큰은 배우 **위** 한 줄이다 — 텍스트 줄에 섞이면 이름·의도와 같은 무게로 읽힌다 */}
      <TokenRow tokens={enemy.tokens} />
      <span className="name">
        <b>{name}</b>
        {/* 패시브는 이름 옆이다 — guard·shell을 모르면 대상 선택이 도박이다 */}
        {passives.map(([id, stacks]) => <em key={id} className="passive"><Icon name={id} />{passiveLabels[id]} {stacks}</em>)}
      </span>
      <span className="intent"><Icon name={hidden ? "omen" : intentIcon(enemy.intent)} />{intent}</span>
      <span className="hp">
        {/* 채움은 `width`가 아니라 `scaleX`다 — `width`는 매 프레임 layout + paint고 이것은 GPU로 간다 */}
        <i style={{ "--fill": enemy.hp / enemy.maxHp } as CSSProperties} />
        <small>{enemy.hp} / {enemy.maxHp}</small>
      </span>
      {enemy.block > 0 && <span className="badges"><em>방어 {enemy.block}</em></span>}
      <DamagePop hits={hits} id={enemy.id} seq={hitSeq} still={reducedMotion} />
    </m.button>
  );
}

/**
 * 지금 걸린 약속. 요구를 수락하고 전투에 들어가면 화면에 흔적이 하나도 없던 자리다 — 무엇을
 * 약속했는지, 지금 지키고 있는지, 이미 깨졌는지 셋 다 볼 방법이 없었다.
 *
 * `omen`이 걸어 둔 약속도 같은 줄에 선다(둘까지 온다). 값은 전부 관측에서 오고 **여기서 다시 재는
 * 것이 없다** — `settled`가 있으면 그 조우 안에서는 다시 안 바뀐다(사실이 단조다)
 */
function PromiseRow({ promises }: { promises: PromiseView[] }) {
  if (!promises.length) return null;
  return (
    <div className="promise-row">
      {promises.map(({ god, text, rule, current, target, settled }) => (
        <p
          key={`${god}:${rule}`}
          className={`promise${settled ? ` ${settled}` : ""}`}
          style={{ "--god-color": `var(--${god})` } as CSSProperties}
          title={text}
        >
          <Icon name="favor" />
          <b>{godName(god)}</b>
          <span>{rule}</span>
          <em>{current} / {target}</em>
        </p>
      ))}
    </div>
  );
}

/** 파워가 걸리는 훅 넷. 표가 `Trigger`를 다 덮으므로 훅을 새로 만들면 여기서 컴파일이 막힌다 */
const triggerLabels: Record<Trigger, string> = {
  turn_start: "턴 시작", turn_end: "턴 끝", on_play: "카드 낼 때", on_unblocked: "막히지 않은 피해",
};

/**
 * 배우 하나 = 우호도 · 토큰 · 파워 · 스탯. 위에서부터 「신이 무엇을 할까 → 내게 무엇이 붙었나 →
 * 매 턴 무엇이 일하나 → 지금 값」 순서다. 적 버튼과 같은 눈금을 쓴다
 */
function PlayerActor({ view, reducedMotion }: { view: CombatObservation; reducedMotion: boolean }) {
  return (
    <div className="player-actor">
      {/* 병사는 오른쪽을 보고 적은 왼쪽을 본다(P-32 §1) — 좌우 반전을 넣지 않는다 */}
      <span className="sprite"><img src={spriteArt["../art/sprites/player.webp"]} alt="" /></span>
      {/**
       * **후원 둘만** 그린다. 나머지 셋은 칸이 없다 — `state.favor`가 조합 둘만 들고, 조합 밖의 신에게는
       * 호의를 움직일 것이 없다(사유는 reviews/26-hud.md). 후원 둘은 평온에서도 매 턴 개입한다
       */}
      <div className="favor-row">
        {view.patrons.map((god) => (
          <FavorMeter key={god} god={god} value={view.favor[god] ?? favorInitial} grace={view.grace[god] ?? 0} />
        ))}
      </div>
      <TokenRow tokens={view.tokens} />
      <PowerRow powers={view.powers} />
      <div className="player-bar">
        <span>체력 <b>{view.hp} / {view.maxHp}</b></span>
        <DamagePop hits={view.hits} id="player" seq={view.hitSeq} still={reducedMotion} />
        <span>방어 <b>{view.block}</b></span>
        <span>에너지 <b>{view.energy}</b></span>
        <span>뽑을 카드 <b>{view.draw}</b></span>
      </div>
    </div>
  );
}

/**
 * 단계 경계는 `favorBoundaries`에서 읽는다 — 눈금을 UI에 다시 박으면 규칙이 바뀔 때 화면만 옛 자리에
 * 남는다. 진노는 경고색이다: 그 단계의 개입이 조우 시작과 **전투 중**에 터지므로 플레이어가 그 전에 알아야 한다
 */
function FavorMeter({ god, value, grace }: { god: string; value: number; grace: number }) {
  const stage = favorStage(value);
  /**
   * 경계를 넘는 순간에만 한 번 펄스한다 — **그 순간 신의 행동이 바뀐다**(조우 시작 개입과 전투 중
   * 개입이 둘 다 달라진다). 직전 단계를 `useRef`에 드는 이유는 `useEffect`로 걸면 전투에 들어설
   * 때마다 미터 둘이 첫 렌더에 번쩍이기 때문이다
   */
  const seen = useRef(stage);
  const crossed = seen.current !== stage;
  useEffect(() => {
    // 미터가 펄스하는 그 프레임에 신이 말한다 — 단계가 바뀌면 그 신이 다음에 할 일이 통째로 바뀐다
    if (crossed) speak(2, god, godLine(god, "cross", value, stage));
    seen.current = stage;
  });
  const { start, turn } = godStageText(god, stage);
  const stageText = [stageName[stage], start && `조우 시작에 ${start}`, turn && `${interventionEveryTurns}턴마다 ${turn}`].filter(Boolean).join(" · ");
  return (
    <div
      className={`favor ${stage}${crossed ? " crossed" : ""}`}
      role="img"
      aria-label={`${godName(god)} 호의 ${value} ${stageText}${grace ? ` 은총 ${grace}` : ""}`}
      title={`${stageText} — 헌신 ${favorBoundaries.devotion} / 평온 ${favorBoundaries.calm} / 분노 ${favorBoundaries.anger}`}
    >
      <small>{godName(god)}</small>
      <b>{value} · {stageName[stage]}</b>
      {/* 은총은 슬롯 표시와 다른 사실이다 — 받은 **수**(다음 은혜의 tier·합성 전제)고 슬롯은 걸린 것이다 */}
      {grace > 0 && <em>은총 {grace}</em>}
      <span className="meter">
        <i style={{ "--fill": value / 100 } as CSSProperties} />
        {Object.values(favorBoundaries).filter((at) => at > 0).map((at) => (
          <span key={at} className="tick" style={{ left: `${at}%` }} />
        ))}
      </span>
    </div>
  );
}

/**
 * 파워는 카드가 손을 떠난 뒤 전투 내내 매 턴 일한다 — 흔적이 없으면 몇 장 냈는지 플레이어가 세고
 * 있어야 한다. 같은 파워를 두 장 내면 두 번 등록되므로(상한 없음) 스택을 세서 「×2」로 적는다
 */
function PowerRow({ powers }: { powers: CombatObservation["powers"] }) {
  if (!powers.length) return null;
  const stacked = powers.reduce<(CombatObservation["powers"][number] & { count: number })[]>((all, power) => {
    const seen = all.find(({ card, trigger }) => card.id === power.card.id && trigger === power.trigger);
    if (seen) seen.count += 1;
    else all.push({ ...power, count: 1 });
    return all;
  }, []);
  const label = stacked.map(({ card, trigger, count }) => `${triggerLabels[trigger]} ${card.name}${count > 1 ? ` ${count}개` : ""}`).join(" ");
  return (
    <span className="power-row" role="img" aria-label={`파워 ${label}`}>
      {stacked.map(({ card, trigger, count }) => (
        <em key={`${card.id}-${trigger}`} title={`${triggerLabels[trigger]} · ${effectText(card)}`}>
          {card.name}{count > 1 && <b>×{count}</b>}
        </em>
      ))}
    </span>
  );
}

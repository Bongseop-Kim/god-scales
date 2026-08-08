import { AnimatePresence, m, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import type { CSSProperties, Ref } from "react";
import { ENERGY_PER_TURN, MAX_SLOTS, type EnemyAction } from "../../core/combat.ts";
import { favorInitial, favorStage, godEnemyId, intervenesOnTurn, type FavorStage, type StageEffect } from "../../core/favor.ts";
import { floorsPerRegion } from "../../core/map.ts";
import type { PassiveName, Trigger } from "../../core/state.ts";
import enemyDataJson from "../../data/enemies.json" with { type: "json" };
import { endTurnAction, type CardView, type CombatDecision, type CombatObservation, type PromiseView } from "../../sim/engine.ts";
import { tagParticle } from "../shared/art-keys.ts";
import { Backdrop, backdropArt } from "../shared/backdrop.tsx";
import { cardTagOf, effectText, GameCard } from "../shared/card.tsx";
import { playSprite, shake, speak } from "../shared/fx.ts";
import { godArt, godLine, godName, godStageEffects, godStageText, stageName } from "../shared/header.tsx";
import { Icon, type IconName } from "../shared/icon.tsx";
import { passiveName, tokenName, tokenSummary, TokenRow } from "../shared/tokens.tsx";

const spriteArt = import.meta.glob<string>("../../art/sprites/*.webp", { eager: true, query: "?url", import: "default" });
const fxArt = import.meta.glob<string>("../../art/fx/*.webp", { eager: true, query: "?url", import: "default" });
const particleArt = import.meta.glob<string>("../../art/particle/*.webp", { eager: true, query: "?url", import: "default" });
/**
 * 개입 op → 파티클 한 장. **카드가 쓰는 넷과 같은 파일이다**(`tagParticle`) — 개입마다 새로 그리지
 * 않는다. 카드와 갈리는 것은 그림이 아니라 자리다: 신의 것은 `strike`가 위에서 내려온다
 */
const opParticle: Record<string, string> = { damage: "slash_01", block: "window_01", heal: "magic_01", apply_token: "magic_01" };

type EnemyInfo = { id: string; name: string; intent_visible: boolean };
const enemyInfo = new Map((enemyDataJson as EnemyInfo[]).map((enemy) => [enemy.id, enemy]));
const pop = { duration: 0.16, ease: [0.23, 1, 0.32, 1] } as const;
/** 적이 쓰러지는 두 프레임을 보여 준 뒤 사라지는 500ms. popLayout이라 판은 즉시 닫힌다 */
const exitPop = { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const, times: [0, 0.6, 1] };
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
 * 머리 위 의도 — **아이콘 16 + 숫자만**이다(P-55). 문장형(«공격 7 + 방어 5»)은 `aria-label`과
 * hover 툴팁으로 물러났다. 순서는 `intentLabel`의 조각 순서와 같고, 의도를 감추는 적은 `omen` 하나다
 */
const intentBits = (action?: EnemyAction): [IconName, number | undefined][] => {
  const bits: [IconName, number | undefined][] = [];
  if (action?.damage) bits.push(["damage", action.damage]);
  if (action?.block) bits.push(["block", action.block]);
  if (action?.heal) bits.push(["heal", action.heal]);
  if (action?.token) bits.push([action.token, action.stacks ?? 1]);
  if (action?.favor) bits.push(["favor", action.favor]);
  return bits.length ? bits : [["idle", undefined]];
};

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

/** 턴 배너 한 장(P-58) — `playSprite`처럼 DOM에 붙였다 지운다. 상태가 없어 리렌더와 무관하다 */
function sweepBanner(text: string): void {
  const node = document.createElement("b");
  node.className = "turn-banner";
  node.textContent = text;
  document.body.append(node);
  node.animate(
    [{ opacity: 0, transform: "scaleX(.2)" }, { opacity: 1, transform: "scaleX(1)", offset: 0.35 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }],
    { duration: 400, easing: "ease-out" },
  ).finished.finally(() => node.remove());
}

/**
 * 타겟팅 화살표(P-58) — 무대 카드에서 커서까지 점선 베지어. P-55의 크로스헤어 커서와 한 세트다.
 * 렌더 밖 SVG 한 장에 `pointermove`가 경로만 다시 쓴다 — React 상태를 태우면 마우스마다 리렌더다
 */
function AimArrow({ from }: { from: React.RefObject<HTMLDivElement | null> }) {
  const path = useRef<SVGPathElement>(null);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const rect = from.current?.getBoundingClientRect();
      const x0 = rect ? rect.left + rect.width / 2 : innerWidth / 2;
      const y0 = rect ? rect.top + 8 : innerHeight * 0.7;
      const bendX = (x0 + event.clientX) / 2;
      const bendY = Math.min(y0, event.clientY) - 90;
      path.current?.setAttribute("d", `M ${x0} ${y0} Q ${bendX} ${bendY} ${event.clientX} ${event.clientY}`);
    };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, [from]);
  return <svg className="aim-arrow" aria-hidden="true"><path ref={path} /></svg>;
}

export function CombatScreen({ seed, decision, onAnswer, onOpenJournal }: {
  seed: number;
  decision: CombatDecision;
  onAnswer: (choice: string) => void;
  /** 약속 칩 클릭이 저널(P-53)을 연다 — 오버레이 상태는 App이 든다 */
  onOpenJournal?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { phase, options, observation: view } = decision;
  const targeting = phase === "target";
  const transition = reducedMotion ? { duration: 0 } : pop;
  const enemySide = useRef<HTMLDivElement>(null);
  const playerSide = useRef<HTMLDivElement>(null);
  /** 타겟팅 화살표의 출발점 — 무대 카드가 선 자리 */
  const stageRef = useRef<HTMLDivElement>(null);

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
    const timers: ReturnType<typeof setTimeout>[] = [];
    view.patrons.forEach((god, index) => {
      const stage = favorStage(view.favor[god] ?? favorInitial);
      const text = godStageText(god, stage)[start ? "start" : "turn"];
      timers.push(setTimeout(() => {
        /**
         * **말은 판을 안 흔들어도 나온다** — 컷인은 「무엇을 했는가」라 데이터가 없으면 빈 문장이지만,
         * 아무것도 안 하는 단계에도 신은 말한다. 조우 시작은 말(L2)이고 개입 턴은 자막(L1)이다:
         * 런당 49회 뜨는 자리를 화면 중앙에 2초씩 세우면 전투가 아니라 낭독이 된다
         */
        speak(start ? 2 : 1, god, godLine(god, start ? "encounter" : "intervene", start ? view.depth : view.turn, stage));
        const effects = godStageEffects(god, stage, hook);
        // 「신이 적으로 합류」는 판이 뒤집히는 사건이라 480ms 페이드로 지나가면 안 된다 — 신 일러가 선다
        const joinEffect = effects.find(({ op }) => op === "join");
        const source = joinEffect ? godArt[`../../art/gods/${god}.webp`] : fxArt[`../../art/fx/${stage}.webp`];
        if (text && source) void playSprite(document.body, source, "cut", { god, stage, text: `${godName(god)} · ${stageName[stage]} — ${text}` });
        /**
         * 합류는 외침(L3)이다. **컷인이 끝난 뒤**에 낸다 — 같이 내면 L3의 어두운 배경이 「무엇을
         * 했는가」를 덮어 버린다. 신을 버려 놓고 그 신이 판 건너편에 서는 순간이라 스치면 안 된다
         */
        if (joinEffect) {
          const joined = joinEffect.god ?? god;
          // 이 타이머도 `timers`에 든다 — 안 걷으면 화면·조우가 바뀐 뒤 묵은 외침이 선다
          timers.push(setTimeout(() => speak(3, joined, godLine(joined, "join", view.depth), godArt[`../../art/gods/${joined}.webp`]), 480));
        }
        if (reducedMotion) return;
        // 피해 개입은 화면이 흔들린다. 진노만 크게 — `.fx`와 같은 WAAPI라 새 의존이 없다
        if (effects.some(({ op }) => op === "damage")) shake(stage === "wrath" ? 10 : 4, 200);
        for (const effect of effects) {
          const sprite = particleArt[`../../art/particle/${opParticle[effect.op]}.webp`];
          for (const host of hostsFor(effect.target)) {
            // 카드 파티클은 제자리에서 터지고 신의 것은 위에서 내려온다 — 한눈에 갈린다
            if (effect.op === "damage" || effect.op === "block") void playSprite(host, fxArt["../../art/fx/strike.webp"], "spark");
            if (sprite) void playSprite(host, sprite, "spark");
          }
        }
      }, index * 220));
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
    const source = particleArt[`../../art/particle/${tagParticle[cardTagOf(card.id) ?? ""]}.webp`];
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
      once(`${view.depth}:torn:${seq}`, () => speak(3, god, godLine(god, "tear", seq), godArt[`../../art/gods/${god}.webp`]));
    }
    /**
     * 화해 — 진노로 합류한 신이 판에서 사라지는 순간이다. 호의를 평온 하한으로 돌리는 것은 조우가
     * **이긴 채로** 끝난 뒤라(`sim/engine.ts`의 `felled`) 여기서 말하는 것이 엔진보다 조금 이르다:
     * 이 뒤에 지면 화해는 없다. 그래도 사람이 보는 사건은 신이 쓰러지는 이 프레임이다
     */
    const onBoard = view.enemies.map(({ id }) => id).filter((id) => view.patrons.some((god) => godEnemyId(god) === id));
    for (const gone of godsOnBoard.current.filter((id) => !onBoard.includes(id))) {
      const god = view.patrons.find((patron) => godEnemyId(patron) === gone)!;
      once(`${view.depth}:felled:${god}`, () => speak(3, god, godLine(god, "reconcile", view.depth), godArt[`../../art/gods/${god}.webp`]));
    }
    godsOnBoard.current = onBoard;
  }, [decision]);

  /**
   * 피격 연출(P-58) — 맞은 쪽 흰 플래시 120ms + 셰이크 4px, 때린 쪽 20px 전진.
   * 관측의 `hitSource`가 카드·신 개입·적 턴을 가른다. 적 공격자만 직전 렌더의 의도로 찾는다 — 적 턴
   * 피해가 온 프레임에는 의도가 이미 다음 것으로 넘어가 있다. WAAPI의 `translate`·`filter` 속성은
   * motion이 쓰는 `transform`과 다른 채널이라 layout 애니메이션과 안 싸운다
   */
  const prevAttackers = useRef<string[]>([]);
  useEffect(() => {
    const attackers = prevAttackers.current;
    prevAttackers.current = view.enemies.filter(({ intent }) => intent?.damage).map(({ id }) => id);
    if (!view.hits.length || reducedMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const posed = new Set<HTMLElement>();
    const pose = (node: HTMLElement | null | undefined, name: "attack" | "hit", duration: number) => {
      if (!node) return;
      node.dataset.pose = name;
      posed.add(node);
      timers.push(setTimeout(() => delete node.dataset.pose, duration));
    };
    for (const { id } of view.hits) {
      const node = id === "player" ? playerSide.current : enemySide.current?.querySelector<HTMLElement>(`[data-enemy="${id}"]`);
      pose(node, "hit", 200);
      node?.animate([{ filter: "brightness(2.2)" }, { filter: "brightness(1)" }], { duration: 120, easing: "ease-out" });
      node?.animate([{ translate: "-4px 0" }, { translate: "4px 0" }, { translate: "0 0" }], { duration: 200, easing: "ease-in-out" });
    }
    // 병사가 쳤으면 병사가, 적 턴이면 직전 의도가 공격이던 적들이 나선다(160ms 전진 + 복귀)
    if (view.hitSource === "attack" && view.hits.some(({ id }) => id !== "player")) {
      pose(playerSide.current, "attack", 250);
      playerSide.current?.animate([{ translate: "0 0" }, { translate: "20px 0", offset: 0.5 }, { translate: "0 0" }], { duration: 320, easing: "ease-out" });
    }
    if (view.hitSource === "enemy" && view.hits.some(({ id }) => id === "player")) {
      for (const id of attackers) {
        const node = enemySide.current?.querySelector<HTMLElement>(`[data-enemy="${id}"]`);
        pose(node, "attack", 250);
        node?.animate([{ translate: "0 0" }, { translate: "-20px 0", offset: 0.5 }, { translate: "0 0" }], { duration: 320, easing: "ease-out" });
      }
    }
    return () => {
      for (const timer of timers) clearTimeout(timer);
      for (const node of posed) delete node.dataset.pose;
    };
  }, [view.hitSeq]);

  /**
   * 턴 배너(P-58) — 「내 턴 / 적 턴」 400ms 스윕. 적 턴은 「턴 종료」 클릭이, 내 턴은 turn 증가가
   * 낸다(적 턴 배너가 지나간 뒤 420ms). 줄인 모션에서는 안 낸다 — 장식이고 정보는 상태 바의 턴 수다
   */
  useEffect(() => {
    if (reducedMotion || view.turn === 1) return;
    const timer = setTimeout(() => sweepBanner("내 턴"), 420);
    return () => clearTimeout(timer);
  }, [view.turn]);

  // 무대에 선 카드는 손패에서 빠진다 — 엔진은 target을 받은 뒤에 카드를 버리므로 아직 `hand`에 있다
  const staged = targeting ? view.hand.findIndex(({ id }) => id === view.card) : -1;
  const keys = handKeys(view.hand);
  const fan = view.hand.map((card, index) => ({ card, key: keys[index] })).filter((_, index) => index !== staged);
  /** 낼 수 있는 카드가 남았는가 — 에너지 젬 맥동(P-58)의 조건. 0이면 무채색(P-55) */
  const canPlay = phase === "card" && options.some((option) => option !== endTurnAction);

  return (
    <>
      {/* 무대가 곧 배경이다(P-55) — .55로 살리고, 대상 선택 중에는 .35로 물러난다. 프롭 3겹 5개 */}
      <Backdrop src={backdropArt(view.region, view.floor === floorsPerRegion ? "boss" : "combat")} region={view.region} seed={seed + view.depth} tone={targeting ? "aim" : "stage"} />
      <div className="shell run combat-stage">
      {/* 약속·파워 칩 — 상태 바 바로 아래 좌측, 판보다 먼저 읽힌다(P-55 §5) */}
      <div className="board-chips">
        <PromiseRow promises={view.promises} onOpen={onOpenJournal} />
        <PowerRow powers={view.powers} />
      </div>

      {/**
        * 무대 지면. 패널 상자가 없다 — 병사(224)는 왼쪽, 적(224)은 오른쪽 칸 0→3이 같은
        * 지면선에 선다. 칸 넷을 언제나 그린다: **빈 칸도 자리를 지킨다**(사거리의 근거).
        * `popLayout`이 퇴장 중인 적을 흐름에서 뺀다. ref는 개입 파티클의 `hostsFor`가 쓴다
        */}
      <div className={`stage-field${targeting ? " aiming" : ""}`} ref={enemySide}>
        <PlayerActor view={view} reducedMotion={!!reducedMotion} ref={playerSide} />
        <AnimatePresence initial={false} mode="popLayout">
          {slots.map((slot) => {
            const enemy = view.enemies.find((candidate) => candidate.slot === slot);
            // 두 칸짜리가 덮은 칸. 자리표시를 그리면 판이 다섯 칸이 된다
            const covered = view.enemies.some((candidate) => candidate.slot < slot && candidate.slot + candidate.span > slot);
            if (covered) return null;
            // 빈 칸은 바닥 점선 타원이다 — 자리를 지키는 것이 존재 이유(사거리의 근거)라 지우지 않는다
            if (!enemy) return <p key={slot} className="enemy empty" aria-hidden="true" style={{ "--slot": slot } as CSSProperties}>{slotLabel(slot)}</p>;
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

      <div className="combat-bottom">
        {/**
          * 좌하단 에너지 젬 — 숫자만, 최대치는 우하 작은 원(P-55 §3). 「에너지」·「뽑을 카드」
          * 글자 라벨은 지웠다 — `aria-label`에만 남는다
          */}
        <div className="resources">
          {/* 낼 수 있는 카드가 남으면 1.04 맥동, 에너지 0이면 무채색(P-58) — 정보는 숫자가 든다 */}
          <span className={`energy-gem${view.energy === 0 ? " drained" : ""}${canPlay ? " ready" : ""}`} role="img" aria-label={`에너지 ${view.energy} / ${ENERGY_PER_TURN}`}>
            {view.energy}
            <small aria-hidden="true">{ENERGY_PER_TURN}</small>
          </span>
          <span className="draw-pile" role="img" aria-label={`뽑을 카드 ${view.draw}장`}>
            <i aria-hidden="true" />
            <b>{view.draw}</b>
          </span>
        </div>
        {/* 평소엔 침묵한다 — 카드 단계는 화면이 이미 말한다. 대상 선택만 문장이 필요하다 */}
        <p className="hint" role="status">{targeting ? "대상을 고르세요" : ""}</p>
        {/**
         * 무대. **흐름 밖 오버레이라 서고 사라져도 판이 안 덜컥인다**(UI.md 제1규칙) — 자리는
         * 병사와 적 진영 사이 비무장지대(`.stage`).
         * **맥동·발광 루프를 넣지 않는다** — 사람이 적을 고르는 내내 시야에서 움직인다.
         * 정지가 「너를 기다린다」다. 줄인 모션에서는 자리만 남고 들어오는 이동이 없다
         */}
        <div className="stage" ref={stageRef}>
          {staged >= 0 && (
            <m.div
              key={view.card}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reducedMotion ? { duration: 0 } : stageIn}
            >
              <GameCard cardId={view.hand[staged].id} card={view.hand[staged]} />
            </m.div>
          )}
        </div>
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
        {/* 우하단 160×46 — 일부러 기본 버튼이다. 매 턴 누르는 자리라 청동 스킨으로 소리치면 피곤하다 */}
        <button
          className="end-turn"
          type="button"
          disabled={targeting}
          onClick={() => {
            if (!reducedMotion) sweepBanner("적 턴");
            onAnswer(endTurnAction);
          }}
        >턴 종료</button>
      </div>
      </div>
      {/* 대상 선택 중에만 산다 — 점선 베지어가 무대 카드에서 커서로 간다. 줄인 모션에서는 커서가 말한다 */}
      {targeting && !reducedMotion && <AimArrow from={stageRef} />}
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
 * 렌더의 props를 그대로 들고 있어서, 대상 선택 중에 죽은 적은 퇴장 동안 `disabled`가 아닌 채로 DOM에
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
  const sprite = spriteArt[`../../art/sprites/${enemy.id}.webp`];
  const info = enemyInfo.get(enemy.id);
  const name = info?.name ?? enemy.id;
  const hidden = info?.intent_visible === false;
  const intent = hidden ? "의도 감춤" : intentLabel(enemy.intent);
  const passives = Object.entries(enemy.passives) as [PassiveName, number][];
  return (
    <m.button
      ref={ref}
      // 칩 행의 높이는 애니메이션하지 않는다 — 적의 칸 이동만 보간해야 스프라이트가 상태 변화에 안 흔들린다
      layout={reducedMotion ? false : "position"}
      transition={reducedMotion ? { duration: 0 } : pop}
      exit={reducedMotion ? { opacity: 0 } : { opacity: [1, 1, 0], scale: [1, 1, 0.92], transition: exitPop }}
      className={enemy.span > 1 ? "enemy wide" : "enemy"}
      data-pose={present ? undefined : "death"}
      // 개입 파티클이 맞은 판을 여기서 찾는다 — 적마다 ref를 하나 더 다는 대신이다(`popLayout`이 ref를 이미 쓴다)
      data-enemy={enemy.id}
      // 칸이 곧 자리다(P-55) — `--slot`이 지면 위 x를 정하고, 두 칸짜리는 `--span`이 중심을 옮긴다
      style={{ "--slot": slot, "--span": enemy.span } as CSSProperties}
      type="button"
      disabled={!enabled || !present}
      onClick={onSelect}
      // 문장형 의도는 여기와 title로 물러났다(P-55) — 배지마다 읽히면 적 하나가 문장 여섯이 된다
      aria-label={`${slotLabel(slot, enemy.span)} ${name} 체력 ${enemy.hp} ${intent} ${passives.map(([id, stacks]) => `${passiveName(id)} ${stacks}`).join(" ")} ${tokenSummary(enemy.tokens)}`}
      title={`${name} — ${intent}`}
    >
      {/* 머리 위 의도 — 아이콘 16 + 숫자만. 문장은 `aria-label`·hover 툴팁이 든다 */}
      <span className="intent" aria-hidden="true">
        {hidden
          ? <em><Icon name="omen" /></em>
          : intentBits(enemy.intent).map(([icon, value], index) => <em key={index}><Icon name={icon} />{value}</em>)}
      </span>
      {sprite && <span className="sprite"><img src={sprite} alt="" /></span>}
      {/* 이름은 hover/focus에서만 — 정지 화면의 주인공은 스프라이트다 */}
      <b className="name" aria-hidden="true">{name}</b>
      <span className="hp">
        {/* 채움은 `width`가 아니라 `scaleX`다 — `width`는 매 프레임 layout + paint고 이것은 GPU로 간다 */}
        <i style={{ "--fill": enemy.hp / enemy.maxHp } as CSSProperties} />
        <small>{enemy.hp} / {enemy.maxHp}</small>
      </span>
      {/* 발밑 칩 한 줄 — 방어·패시브·토큰. 자리를 예약해 첫 토큰에 이웃이 안 밀린다(UI.md) */}
      <span className="chips">
        {enemy.block > 0 && <em className="shield">방어 {enemy.block}</em>}
        {passives.map(([id, stacks]) => <em key={id} className="passive"><Icon name={id} />{passiveName(id)} {stacks}</em>)}
        <TokenRow tokens={enemy.tokens} />
      </span>
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
function PromiseRow({ promises, onOpen }: { promises: PromiseView[]; onOpen?: () => void }) {
  if (!promises.length) return null;
  return (
    <div className="promise-row">
      {promises.map(({ god, text, rule, current, target, settled, deposit, quest }) => (
        // 칩이 버튼이다(P-55) — 누르면 약속 저널(P-53)이 열린다
        <button
          type="button"
          key={`${quest ? "quest" : "bet"}:${god}:${rule}`}
          className={`promise${settled ? ` ${settled}` : ""}`}
          style={{ "--god-color": `var(--${god})` } as CSSProperties}
          title={text}
          onClick={onOpen}
        >
          <Icon name="favor" />
          <b>{godName(god)}</b>
          <span>{rule}</span>
          {/* 예치한 최대 체력은 승부 카드 줄에만 선다 — 그 줄의 판돈이 그것이다 (P-59 §5) */}
          {quest ? <i className="stake">퀘스트</i> : deposit ? <i className="stake">최대 체력 {deposit}</i> : null}
          <em>{current} / {target}</em>
        </button>
      ))}
    </div>
  );
}

/** 파워가 걸리는 훅 넷. 표가 `Trigger`를 다 덮으므로 훅을 새로 만들면 여기서 컴파일이 막힌다 */
const triggerLabels: Record<Trigger, string> = {
  turn_start: "턴 시작", turn_end: "턴 끝", on_play: "카드 낼 때", on_unblocked: "막히지 않은 피해",
};

/**
 * 병사 — 적과 같은 눈금이다(P-55): 고정된 스프라이트, 발밑 체력 바 140×16, 그 아래 상태 칩.
 * 우호도 미터는 상태 바(P-54)가, 파워 칩은 좌상단 `board-chips`가, 에너지·뽑을 카드는
 * 좌하단 젬·더미가 든다 — 중복 표시 금지
 */
function PlayerActor({ view, reducedMotion, ref }: { view: CombatObservation; reducedMotion: boolean; ref?: Ref<HTMLDivElement> }) {
  return (
    <div className="player-actor" ref={ref} role="img" aria-label={`병사 체력 ${view.hp} / ${view.maxHp} 방어 ${view.block} ${tokenSummary(view.tokens)}`}>
      {/* 병사는 오른쪽을 보고 적은 왼쪽을 본다(P-32 §1) — 좌우 반전을 넣지 않는다 */}
      <span className="sprite"><img src={spriteArt["../../art/sprites/player.webp"]} alt="" /></span>
      <span className="hp">
        <i style={{ "--fill": view.hp / view.maxHp } as CSSProperties} />
        <small>{view.hp} / {view.maxHp}</small>
      </span>
      <span className="chips">
        {view.block > 0 && <em className="shield">방어 {view.block}</em>}
        <TokenRow tokens={view.tokens} />
      </span>
      <DamagePop hits={view.hits} id="player" seq={view.hitSeq} still={reducedMotion} />
    </div>
  );
}

/**
 * 파워는 카드가 손을 떠난 뒤 전투 내내 매 턴 일한다 — 흔적이 없으면 몇 장 냈는지 플레이어가 세고
 * 있어야 한다. 같은 파워를 두 장 내면 두 번 등록되므로(상한 없음) 스택을 세서 「×2」로 적는다
 */
function PowerRow({ powers }: { powers: CombatObservation["powers"] }) {
  const stacked = powers.reduce<(CombatObservation["powers"][number] & { count: number })[]>((all, power) => {
    const seen = all.find(({ card, trigger }) => card.id === power.card.id && trigger === power.trigger);
    if (seen) seen.count += 1;
    else all.push({ ...power, count: 1 });
    return all;
  }, []);
  const label = stacked.map(({ card, trigger, count }) => `${triggerLabels[trigger]} ${card.name}${count > 1 ? ` ${count}개` : ""}`).join(" ");
  return (
    // 빈 줄도 자리를 지킨다(min-height) — 첫 파워를 내는 순간 손패·버튼이 밀리면 안 된다. 빌 때는 SR에서 감춘다
    <span className="power-row" role="img" aria-label={`파워 ${label}`} aria-hidden={stacked.length ? undefined : true}>
      {stacked.map(({ card, trigger, count }) => (
        <em key={`${card.id}-${trigger}`} title={`${triggerLabels[trigger]} · ${effectText(card)}`}>
          {card.name}{count > 1 && <b>×{count}</b>}
        </em>
      ))}
    </span>
  );
}

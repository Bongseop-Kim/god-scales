import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import type { EnemyAction } from "../core/combat.ts";
import { favorBoundaries, favorInitial, favorStage, intervenesOnTurn, interventionEveryTurns, type FavorStage } from "../core/favor.ts";
import { floorsPerRegion } from "../core/map.ts";
import type { PassiveName, Trigger } from "../core/state.ts";
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import { endTurnAction, type CombatDecision, type CombatObservation } from "../sim/engine.ts";
import { tagParticle } from "./art-keys.ts";
import { Backdrop, backdropArt } from "./backdrop.tsx";
import { cardCaption, cardTagOf, effectText, GameCard } from "./card.tsx";
import { playSprite } from "./fx.ts";
import { godName, godStageText, RunHeader } from "./header.tsx";
import { tokenName, tokenSummary, TokenRow } from "./tokens.tsx";

const spriteArt = import.meta.glob<string>("../art/sprites/*.webp", { eager: true, query: "?url", import: "default" });
const fxArt = import.meta.glob<string>("../art/fx/*.webp", { eager: true, query: "?url", import: "default" });
const godArt = import.meta.glob<string>("../art/gods/*.webp", { eager: true, query: "?url", import: "default" });
const particleArt = import.meta.glob<string>("../art/particle/*.webp", { eager: true, query: "?url", import: "default" });
/**
 * 개입 컷인. **오버레이 셋이 단계 넷을 덮는다** — `open`은 헌신(길이 열린다), `block`은 진노(길이 막힌다),
 * `burst`는 그 사이 둘이다(`art/fx/*.md`). 진노는 조우 시작에만 신 일러가 대신 선다
 */
const stageCut: Record<FavorStage, string> = { devotion: "open", calm: "burst", anger: "burst", wrath: "block" };

type EnemyInfo = { id: string; name: string; intent_visible: boolean };
const enemyInfo = new Map((enemyDataJson as EnemyInfo[]).map((enemy) => [enemy.id, enemy]));
/** 배지에 그대로 나가는 이름. 표가 `PassiveName`을 다 덮으므로 패시브를 새로 만들면 여기서 컴파일이 막힌다 */
const passiveLabels: Record<PassiveName, string> = {
  guard: "보호", shell: "경화", ward: "결계", curl: "웅크림",
  angry: "분노", rally: "규합", ramp: "고조", spite: "앙심",
};
const pop = { duration: 0.16, ease: [0.23, 1, 0.32, 1] } as const;
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
  const side = action?.target === "ally" ? "아군 " : "";
  const parts = [
    action?.damage && `공격 ${action.damage}`,
    action?.block && `${side}방어 ${action.block}`,
    action?.heal && `${side}회복 ${action.heal}`,
    // 토큰은 한글 이름으로 적는다 — 배지가 「감전」인데 의도가 `shock`이면 같은 것이 두 이름을 갖는다
    action?.token && `${side}${tokenName(action.token)} ${action.stacks ?? 1}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : "대기";
}

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

  /**
   * 조우 시작(1턴)과 개입 턴(2·5·8턴, `intervenesOnTurn`)에 컷인이 뜬다. 그 두 자리가 신이 실제로
   * 판을 흔드는 자리다(`core/favor.ts`의 `on_encounter_start`·`on_turn_start`) — 화면에 아무 표시가
   * 없으면 체력이 왜 깎였는지 플레이어가 모른다
   */
  useEffect(() => {
    const start = view.turn === 1;
    if (reducedMotion || (!start && !intervenesOnTurn(view.turn))) return;
    for (const god of view.patrons) {
      const stage = favorStage(view.favor[god] ?? favorInitial);
      // 조우 시작에는 극단 둘만 선다 — 평온·분노까지 띄우면 전투마다 컷인이 셋이다
      if (start && stage !== "devotion" && stage !== "wrath") continue;
      const source = start && stage === "wrath" ? godArt[`../art/gods/${god}.webp`] : fxArt[`../art/fx/${stageCut[stage]}.webp`];
      if (source) void playSprite(document.body, source, "cut");
    }
  }, [view.turn]);

  /** 카드가 손을 떠날 때 태그 파티클 한 장. 자기 대상이면 내 쪽, 아니면 적 쪽에서 튄다 */
  const answer = (choice: string) => {
    const card = view.hand.find(({ id }) => id === choice);
    const source = particleArt[`../art/particle/${tagParticle[cardTagOf(choice) ?? ""]}.webp`];
    const host = (card?.target === "self" ? playerSide : enemySide).current;
    if (card && source && host && !reducedMotion) void playSprite(host, source, "spark");
    onAnswer(choice);
  };

  return (
    <>
      <Backdrop src={backdropArt(view.region, view.floor === floorsPerRegion ? "boss" : "combat")} region={view.region} seed={seed + view.depth} />
      <div className="shell run-layout combat-layout">
      <RunHeader seed={seed} view={view} title="전투" badge={`${view.turn}턴`} />

      <div className="enemy-panel" ref={enemySide}>
        <h2>적</h2>
        {view.enemies.map((enemy) => {
          const sprite = spriteArt[`../art/sprites/${enemy.id}.webp`];
          const info = enemyInfo.get(enemy.id);
          const name = info?.name ?? enemy.id;
          const intent = info?.intent_visible === false ? "의도 감춤" : intentLabel(enemy.intent);
          const passives = Object.entries(enemy.passives) as [PassiveName, number][];
          return (
            <button
              key={enemy.id}
              className="enemy"
              type="button"
              disabled={!targeting || !options.includes(enemy.id)}
              onClick={() => onAnswer(enemy.id)}
              // 배지마다 읽히면 적 하나가 문장 여섯이 된다 — 버튼 하나에 요약 한 문장이다
              aria-label={`${name} 체력 ${enemy.hp} ${intent} ${passives.map(([id, stacks]) => `${passiveLabels[id]} ${stacks}`).join(" ")} ${tokenSummary(enemy.tokens)}`}
            >
              {/* 스프라이트는 이름 **위** 한 줄이다 — 옆에 세우면 405px 칸에서 의도 한 줄(nowrap)이 넘친다 */}
              {sprite && <span className="sprite"><img src={sprite} alt="" /></span>}
              {/* 토큰은 배우 **위** 한 줄이다 — 텍스트 줄에 섞이면 이름·의도와 같은 무게로 읽힌다 */}
              <TokenRow tokens={enemy.tokens} />
              <span className="name">
                <b>{name}</b>
                {/* 패시브는 이름 옆이다 — guard·shell을 모르면 대상 선택이 도박이다 */}
                {passives.map(([id, stacks]) => <em key={id} className="passive">{passiveLabels[id]} {stacks}</em>)}
              </span>
              <span className="intent">{intent}</span>
              <span className="hp">
                <i style={{ width: `${Math.round((100 * enemy.hp) / enemy.maxHp)}%` }} />
                <small>{enemy.hp} / {enemy.maxHp}</small>
              </span>
              {enemy.block > 0 && <span className="badges"><em>방어 {enemy.block}</em></span>}
              <DamagePop hits={view.hits} id={enemy.id} seq={view.hitSeq} still={!!reducedMotion} />
            </button>
          );
        })}
      </div>

      <div className="decision-panel" ref={playerSide}>
        <PlayerActor view={view} reducedMotion={!!reducedMotion} />
        <p className="hint" role="status">{targeting ? `${view.card} · 대상을 고르세요` : "낼 카드를 고르세요"}</p>
        <div className="hand">
          <AnimatePresence initial={false}>
            {view.hand.map((card, index) => (
              <m.div
                key={`${card.id}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={transition}
              >
                <GameCard
                  cardId={card.id}
                  name={card.name}
                  caption={cardCaption(card)}
                  disabled={targeting || !options.includes(card.id)}
                  onSelect={() => answer(card.id)}
                />
              </m.div>
            ))}
          </AnimatePresence>
        </div>
        <button className="primary" type="button" disabled={targeting} onClick={() => onAnswer(endTurnAction)}>턴 종료</button>
      </div>
      </div>
    </>
  );
}

const stageName: Record<FavorStage, string> = { devotion: "헌신", calm: "평온", anger: "분노", wrath: "진노" };
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
  const { start, turn } = godStageText(god, stage);
  const stageText = [stageName[stage], start && `조우 시작에 ${start}`, turn && `${interventionEveryTurns}턴마다 ${turn}`].filter(Boolean).join(" · ");
  return (
    <div
      className={`favor ${stage}`}
      role="img"
      aria-label={`${godName(god)} 호의 ${value} ${stageText}${grace ? ` 은총 ${grace}` : ""}`}
      title={`${stageText} — 헌신 ${favorBoundaries.devotion} / 평온 ${favorBoundaries.calm} / 분노 ${favorBoundaries.anger}`}
    >
      <small>{godName(god)}</small>
      <b>{value} · {stageName[stage]}</b>
      {/* 은총은 슬롯 표시와 다른 사실이다 — 받은 **수**(다음 은혜의 tier·합성 전제)고 슬롯은 걸린 것이다 */}
      {grace > 0 && <em>은총 {grace}</em>}
      <span className="meter">
        <i style={{ width: `${value}%` }} />
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

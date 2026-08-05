import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { EnemyAction } from "../core/combat.ts";
import enemyDataJson from "../data/enemies.json" with { type: "json" };
import { endTurnAction, type CombatDecision, type CombatObservation } from "../sim/engine.ts";
import { cardCaption, GameCard } from "./card.tsx";
import { RunHeader } from "./header.tsx";
import { TokenRow } from "./tokens.tsx";

type EnemyInfo = { id: string; name: string; intent_visible: boolean };
const enemyInfo = new Map((enemyDataJson as EnemyInfo[]).map((enemy) => [enemy.id, enemy]));
/** 배지에 그대로 나가는 이름. 패시브를 새로 만들면 여기 한 줄이 같이 늘어난다 */
const passiveLabels: Record<string, string> = {
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
    action?.block && `방어 ${action.block}`,
    action?.heal && `${side}회복 ${action.heal}`,
    action?.token && `${side}${action.token} ${action.stacks ?? 1}`,
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

  return (
    <div className="shell run-layout">
      <RunHeader seed={seed} view={view} title="전투" badge={`${view.turn}턴`} />

      <div className="enemy-panel">
        <h2>적</h2>
        {view.enemies.map((enemy) => {
          const info = enemyInfo.get(enemy.id);
          const name = info?.name ?? enemy.id;
          const intent = info?.intent_visible === false ? "의도 감춤" : intentLabel(enemy.intent);
          const passives = Object.entries(enemy.passives);
          return (
            <button
              key={enemy.id}
              className="enemy"
              type="button"
              disabled={!targeting || !options.includes(enemy.id)}
              onClick={() => onAnswer(enemy.id)}
              aria-label={`${name} 체력 ${enemy.hp} ${intent} ${passives.map(([id, stacks]) => `${passiveLabels[id] ?? id} ${stacks}`).join(" ")}`}
            >
              <b>{name}</b>
              <span className="intent">{intent}</span>
              <span className="hp">
                <i style={{ width: `${Math.round((100 * enemy.hp) / enemy.maxHp)}%` }} />
                <small>{enemy.hp} / {enemy.maxHp}</small>
              </span>
              <span className="badges">
                {passives.map(([id, stacks]) => <em key={id} className="passive">{passiveLabels[id] ?? id} {stacks}</em>)}
                {enemy.block > 0 && <em>방어 {enemy.block}</em>}
                <TokenRow tokens={enemy.tokens} />
              </span>
              <DamagePop hits={view.hits} id={enemy.id} seq={view.hitSeq} still={!!reducedMotion} />
            </button>
          );
        })}
      </div>

      <div className="decision-panel">
        <PlayerBar view={view} reducedMotion={!!reducedMotion} />
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
                  onSelect={() => onAnswer(card.id)}
                />
              </m.div>
            ))}
          </AnimatePresence>
        </div>
        <button className="primary" type="button" disabled={targeting} onClick={() => onAnswer(endTurnAction)}>턴 종료</button>
      </div>
    </div>
  );
}

function PlayerBar({ view, reducedMotion }: { view: CombatObservation; reducedMotion: boolean }) {
  return (
    <div className="player-bar">
      <span>체력 <b>{view.hp} / {view.maxHp}</b></span>
      <DamagePop hits={view.hits} id="player" seq={view.hitSeq} still={reducedMotion} />
      <span>방어 <b>{view.block}</b></span>
      <span>에너지 <b>{view.energy}</b></span>
      <span>뽑을 카드 <b>{view.draw}</b></span>
      <TokenRow tokens={view.tokens} />
    </div>
  );
}

import type { DemandCost, DemandReward } from "../core/demands.ts";
import { restHealing } from "../core/map.ts";
import type { DemandDecision, GraceDecision, MapDecision, RunView } from "../sim/engine.ts";
import { Backdrop, backdropArt } from "./backdrop.tsx";
import { CardRow, effectText } from "./card.tsx";
import { godName, RunHeader } from "./header.tsx";

/** 휴식·은혜·요구 셋 다 지도 위의 한 칸짜리 결정이다 — 지도 패널 없이 한 단짜리로 그린다 */
function Screen({ seed, view, title, badge, children }: {
  seed: number;
  view: RunView;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 쉼터·예고·은혜에는 전용 배경이 없다 — 그 지역의 전투 배경을 어둡게 깐다. 새로 그리지 않는다 */}
      <Backdrop src={backdropArt(view.region, "combat")} tone="dim" />
      <div className="shell">
        <RunHeader seed={seed} view={view} title={title} badge={badge} />
        <div className="decision-panel">{children}</div>
      </div>
    </>
  );
}

function Choice({ mark, label, detail, onChoose }: { mark: string; label: string; detail: string; onChoose: () => void }) {
  return (
    <button className="choice" type="button" onClick={onChoose}>
      <span>{mark}</span><b>{label}</b><small>{detail}</small>
    </button>
  );
}

export function RestScreen({ seed, decision, onAnswer }: {
  seed: number;
  decision: MapDecision;
  onAnswer: (choice: string) => void;
}) {
  const { phase, options, observation: view } = decision;
  return (
    <Screen seed={seed} view={view} title="쉼터" badge={`덱 ${view.deck.length}장`}>
      {phase === "rest"
        ? (
          <>
            <h2>어떻게 쉴까요?</h2>
            <Choice mark="회" label="회복" detail={`체력을 ${restHealing} 회복합니다.`} onChoose={() => onAnswer("heal")} />
            <Choice mark="제" label="카드 제거" detail="덱에서 한 장을 영구히 뺍니다. 얇은 덱이 핵심 카드를 더 자주 뽑습니다." onChoose={() => onAnswer("remove")} />
            {/* 강화할 카드가 없으면 관측이 이 답을 안 싣는다 — 서지 않는 칸은 그리지 않는다 */}
            {options.includes("upgrade") && (
              <Choice mark="강" label="카드 강화" detail="덱의 한 장을 키웁니다. 장수는 그대로고, 같은 카드 두 장 중 한 장만 커집니다." onChoose={() => onAnswer("upgrade")} />
            )}
          </>
        )
        : (
          <>
            <h2>어느 카드를 고를까요?</h2>
            {/* 후보가 덱 전체가 아닐 수 있다 — 강화는 `+2`에 닿은 카드와 융합을 뺀다(`sim/engine.ts`) */}
            <CardRow cards={view.deck} options={options} onSelect={onAnswer} />
          </>
        )}
    </Screen>
  );
}

/** 슬롯 이름. 태그가 곧 슬롯이라 카드에 적힌 것과 같은 말이어야 한다 */
const slotName: Record<string, string> = { attack: "공격", defend: "방어", utility: "유틸", token: "토큰" };

/**
 * 은혜 3택1. 은혜는 카드가 아니므로 `CardRow`가 아니라 `Choice` 셋이다 — 고르는 것은 「어느 카드에
 * 붙일까」가 아니라 「어느 슬롯을 어느 신에게 줄까」다. 이미 찬 슬롯이면 **무엇을 밀어내는지** 적는다
 */
export function GraceScreen({ seed, decision, onAnswer }: {
  seed: number;
  decision: GraceDecision;
  onAnswer: (choice: string) => void;
}) {
  const { options, observation: view } = decision;
  return (
    <Screen seed={seed} view={view} title={`${godName(view.god)}의 은혜`} badge={`tier ${view.tier}`}>
      <p className="hint" role="status">
        은혜는 카드 한 장이 아니라 그 슬롯의 모든 카드에 붙습니다. 슬롯당 하나이고, 바꿔도 tier는 남습니다.
      </p>
      {view.offer.map((grace) => (
        <Choice
          key={grace.id}
          mark={slotName[grace.slot] ?? grace.slot}
          label={`${slotName[grace.slot] ?? grace.slot} 슬롯 · tier ${grace.tier} · 덱 ${grace.cards}장`}
          detail={`${effectText({ target: "enemy", effects: grace.effects })} — ${grace.text}${grace.replaces ? ` (지금의 「${grace.replaces}」를 밀어냅니다)` : ""}`}
          onChoose={() => options.includes(grace.id) && onAnswer(grace.id)}
        />
      ))}
    </Screen>
  );
}

/** 단 이름. 답(`tier1`·`tier2`)이 아니라 값이 있는지로 갈린다 — 대가 없는 단이 수락이다 */
const tierName: Record<string, [string, string]> = { tier1: ["수", "수락"], tier2: ["시", "시련"] };

/**
 * 대가는 **지금** 나가는 값이다. 그래서 보상이 아니라 단 이름과 같은 줄에 선다 — 값이 앞에 서지 않으면
 * 결정이 계산이 되지 않는다(마감은 P-26)
 */
const costText = (other: string, cost?: DemandCost): string => {
  if (!cost) return "없음";
  return [
    cost.maxHp ? `최대 체력 −${cost.maxHp} (조우 ${cost.encounters ?? 1}회)` : "",
    // 「즉시」가 아래 `지키면`과 갈라 준다 — 시련은 지금 한 번 치르고, 지키면 관계 벌금을 한 번 더 낸다
    cost.favor ? `${godName(other)} 호의 −${cost.favor} 즉시` : "",
  ].filter(Boolean).join(" · ");
};

/** 서열이 곧 문장 순서다 — 은혜 > 업그레이드 > 호의(`tools/validate.ts`의 `rewardRises`) */
const rewardText = (patron: string, reward: DemandReward): string =>
  [
    reward.grace ? `${godName(patron)}의 은혜 ${reward.grace}개` : "",
    reward.upgrade ? `카드 강화 ${reward.upgrade}장` : "",
    reward.favor ? `${godName(patron)} 호의 +${reward.favor}` : "",
  ].filter(Boolean).join(" · ") || `${godName(patron)} 호의 +0`;

/**
 * 요구는 수락·시련·거절 셋이다. 시련은 값을 **선불로** 치르고 은혜를 받는다 — 5층과 적이 모자란
 * 조우에서는 그 칸이 아예 서지 않으므로 관측이 실어 온 단만 그린다
 */
export function DemandScreen({ seed, decision, onAnswer }: {
  seed: number;
  decision: DemandDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  const penalty = view.penalty ? ` · ${godName(view.other)} 호의 −${Math.abs(view.penalty)}` : "";
  return (
    <Screen seed={seed} view={view} title={`${godName(view.patron)}의 요구`}>
      {view.tiers.map((tier) => {
        const [mark, name] = tierName[tier.action] ?? ["요", tier.action];
        return (
          <Choice
            key={tier.action}
            mark={mark}
            label={`${name} · 대가 ${costText(view.other, tier.cost)}`}
            // 보상은 다음 전투에서 조건을 지켰을 때만 들어간다 — 고르는 것만으로 주지 않는다
            detail={`${tier.text} — 지키면 ${rewardText(view.patron, tier.reward)}${penalty}`}
            onChoose={() => decision.options.includes(tier.action) && onAnswer(tier.action)}
          />
        );
      })}
      <Choice mark="거" label="거절 · 대가 없음" detail="어느 호의도 움직이지 않습니다. 거절에도, 지키지 못해도 벌금은 없습니다." onChoose={() => onAnswer("reject")} />
    </Screen>
  );
}

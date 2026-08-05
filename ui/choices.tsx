import { restHealing } from "../core/map.ts";
import type { DemandDecision, GraceDecision, MapDecision, RunView } from "../sim/engine.ts";
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
    <div className="shell">
      <RunHeader seed={seed} view={view} title={title} badge={badge} />
      <div className="decision-panel">{children}</div>
    </div>
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
          </>
        )
        : (
          <>
            <h2>어느 카드를 뺄까요?</h2>
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

export function DemandScreen({ seed, decision, onAnswer }: {
  seed: number;
  decision: DemandDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  const cost = view.penalty ? ` · ${godName(view.other)} 호의 ${view.penalty}` : "";
  return (
    <Screen seed={seed} view={view} title={`${godName(view.patron)}의 요구`}>
      <p className="lead">{view.text}</p>
      {/* 보상은 다음 전투에서 조건을 지켰을 때만 들어간다 — 수락만으로 주지 않는다 */}
      <Choice mark="수" label="수락" detail={`다음 전투에서 지키면 ${godName(view.patron)} 호의 +${view.reward}${cost}`} onChoose={() => onAnswer("accept")} />
      <Choice mark="거" label="거절" detail="어느 호의도 움직이지 않습니다. 거절에도, 지키지 못해도 벌금은 없습니다." onChoose={() => onAnswer("reject")} />
    </Screen>
  );
}

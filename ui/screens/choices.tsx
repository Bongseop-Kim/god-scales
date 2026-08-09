import type { CSSProperties } from "react";
import { restHealing } from "../../core/map.ts";
import { watchDemand, type DemandDecision, type GraceDecision, type MapDecision, type RunView } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks, Prop } from "../shared/backdrop.tsx";
import { CardRow, effectText } from "../shared/card.tsx";
import { godArt, godName } from "../shared/header.tsx";
import { playSound } from "../shared/sfx.ts";

/**
 * 휴식·은혜·과업 셋 다 지도 위의 한 칸짜리 결정이다 — 지도 패널 없이 한 단짜리로 그린다.
 * 제목·머리글이 없다(P-54) — 어떤 화면인지는 내용이 말하고, 값은 상단 상태 바가 든다.
 * 패널은 680 중앙, **쉼터의 카드 고르기만 전폭**이다(덱 전체가 깔리는 자리, `wide`)
 */
function Screen({ view, wide, campfire, children }: {
  view: RunView;
  wide?: boolean;
  /** 쉼터만 모닥불 역할 프롭이 패널 아래 중앙에 선다(P-58 §12) */
  campfire?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 쉼터·예고·은혜에는 전용 배경이 없다 — 그 지역의 전투 배경을 어둡게 깐다. 새로 그리지 않는다 */}
      <Backdrop src={backdropArt(view.region, "combat")} tone="dim" />
      <div className="shell run">
        {/* 패널 좌우 바깥 1쌍(P-58) — 배경과 UI 사이 레이어라 판을 안 민다 */}
        <Flanks region={view.region} depth={view.depth} />
        {campfire && <Prop name={view.region === "surface" ? "surface_light_shaft" : "under_tartarus_glow"} className="campfire" />}
        <div className={`decision-panel solo${wide ? " wide" : ""}`}>{children}</div>
      </div>
    </>
  );
}

/**
 * 타이틀이 하던 「누구의 무엇」을 과업의 `god-say` 꼴(초상 84 + 신 색 왼 테두리)이 이어받는다.
 * **새 대사를 쓰지 않는다** — 대사 신설은 WRITING.md 신별 목소리 검수가 필요한 별도 작업이라
 * 라벨(「아테나의 은혜 · tier 2」)만 세운다
 */
function GodSay({ god, children }: { god: string; children: React.ReactNode }) {
  const portrait = godArt[`../../art/gods/${god}.webp`];
  return (
    <div className="god-say" style={{ "--god-color": `var(--${god})` } as CSSProperties}>
      {portrait && <img src={portrait} alt="" />}
      <b>{children}</b>
    </div>
  );
}

/** `detail`이 노드인 이유는 과업 하나뿐이다 — 거기서만 조건 줄이 문장 **아래에** 한 겹 더 선다 */
function Choice({ mark, label, detail, disabled, onChoose }: { mark: string; label: string; detail: React.ReactNode; disabled?: boolean; onChoose: () => void }) {
  return (
    // 못 고르는 칸은 `disabled`가 말한다 — 핸들러 안에서 조용히 무시하면 멀쩡한 버튼이 고장으로 읽힌다
    <button className="choice" type="button" disabled={disabled} onClick={() => { playSound("chip-lay-3", 0.35); onChoose(); }}>
      <span>{mark}</span><b>{label}</b><small>{detail}</small>
    </button>
  );
}

export function RestScreen({ decision, upgrading, onAnswer }: {
  decision: MapDecision;
  /**
   * 제거인지 강화인지. `rest_card`는 **둘이 같은 화면**이라 관측만으로는 갈 수 없다(후보가 덱 전체일
   * 수도 있어 길이로도 못 가른다). App이 직전 `rest` 답을 `actions`에 이미 들고 있으므로 새 상태가 아니다
   */
  upgrading?: boolean;
  onAnswer: (choice: string) => void;
}) {
  const { phase, options, observation: view } = decision;
  return (
    // 카드 고르기(rest_card)만 전폭이다 — 덱 전체가 깔리는 자리, 한 줄 7장(P-54)
    <Screen view={view} wide={phase === "rest_card"} campfire>
      {phase === "rest"
        ? (
          <>
            <h2>어떻게 쉴까요?</h2>
            {/* 조언 꼬리(「얇은 덱이…」·「같은 카드 두 장 중…」)는 도움말(P-53)로 갔다 — 결정 정보만 남는다 */}
            <Choice mark="회" label="회복" detail={`체력을 ${restHealing} 회복합니다.`} onChoose={() => onAnswer("heal")} />
            <Choice mark="제" label="카드 제거" detail="덱에서 한 장을 영구히 뺍니다." onChoose={() => onAnswer("remove")} />
            {/* 강화할 카드가 없으면 관측이 이 답을 안 싣는다 — 서지 않는 칸은 그리지 않는다 */}
            {options.includes("upgrade") && (
              <Choice mark="강" label="카드 강화" detail="덱의 한 장을 키웁니다. 장수는 그대로입니다." onChoose={() => onAnswer("upgrade")} />
            )}
          </>
        )
        : (
          <>
            <h2>어느 카드를 고를까요?</h2>
            {/* 후보가 덱 전체가 아닐 수 있다 — 강화는 `+2`에 닿은 카드와 융합을 뺀다(`sim/engine.ts`) */}
            {/* 강화면 후보가 **강화 후** 얼굴로 선다 — 고르기 전과 고른 뒤가 같은 얼굴이다 */}
            <CardRow cards={view.deck} options={options} upgrade={upgrading} onSelect={onAnswer} />
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
export function GraceScreen({ decision, onAnswer }: {
  decision: GraceDecision;
  onAnswer: (choice: string) => void;
}) {
  const { options, observation: view } = decision;
  return (
    <Screen view={view}>
      {/* 상주 힌트(「은혜는 카드 한 장이 아니라…」)는 도움말(P-53)로 갔다 — 라벨이 타이틀을 대신한다 */}
      <GodSay god={view.god}>{godName(view.god)}의 은혜 · tier {view.tier}</GodSay>
      {view.offer.map((grace) => (
        <Choice
          key={grace.id}
          mark={slotName[grace.slot] ?? grace.slot}
          label={`${slotName[grace.slot] ?? grace.slot} 슬롯 · tier ${grace.tier} · 덱 ${grace.cards}장`}
          detail={`${effectText({ target: "enemy", effects: grace.effects })} — ${grace.text}${grace.replaces ? ` (지금의 「${grace.replaces}」를 밀어냅니다)` : ""}`}
          disabled={!options.includes(grace.id)}
          onChoose={() => onAnswer(grace.id)}
        />
      ))}
    </Screen>
  );
}

/** 과업 노드의 셋: 두 신 중 하나를 따르거나 지나간다 */
export function DemandScreen({ decision, onAnswer }: {
  decision: DemandDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  return (
    <Screen view={view}>
      <h2>과업</h2>
      {view.offers.map((offer) => (
        <Choice
          key={offer.action}
          /**
           * 신이 직접 말을 거는 자리인데 누가 말하는지가 화면에 없었다 — 이름 한 글자가 표식이고
           * 일러 다섯은 이미 있다(`art/gods`). 이 계획은 에셋을 새로 만들지 않는다
           */
          mark={godName(offer.god).slice(0, 1)}
          label={`${godName(offer.god)}를 따른다 · ${offer.penalty ? `${godName(offer.other)} 호의 −${Math.abs(offer.penalty)}` : "호의 감소 없음"}`}
          detail={
            <>
              {offer.text}
              <em className="rule">{offer.rule}</em>
              달성하면 {godName(offer.god)} 호의 +{offer.reward.favor}와 카드 후보 3장 중 1장을 고릅니다.
            </>
          }
          disabled={!decision.options.includes(offer.action)}
          onChoose={() => onAnswer(offer.action)}
        />
      ))}
      <Choice
        mark="지"
        label="지나간다"
        detail={view.quest ? "진행 중인 과업을 그대로 유지합니다." : "과업을 받지 않고 맵으로 돌아갑니다."}
        onChoose={() => onAnswer(watchDemand)}
      />
    </Screen>
  );
}

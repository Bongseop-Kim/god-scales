import type { CSSProperties } from "react";
import type { DemandCost, DemandReward } from "../../core/demands.ts";
import { favorInitial, favorStage, oracleSwing } from "../../core/favor.ts";
import { restHealing } from "../../core/map.ts";
import { favorPool, type DemandDecision, type GraceDecision, type MapDecision, type OracleDecision, type RunView } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks, Prop } from "../shared/backdrop.tsx";
import { CardRow, effectText } from "../shared/card.tsx";
import { godArt, godLine, godName, stageName } from "../shared/header.tsx";

/**
 * 휴식·은혜·요구 셋 다 지도 위의 한 칸짜리 결정이다 — 지도 패널 없이 한 단짜리로 그린다.
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
 * 타이틀이 하던 「누구의 무엇」을 요구의 `god-say` 꼴(초상 84 + 신 색 왼 테두리)이 이어받는다.
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

/** `detail`이 노드인 이유는 요구 하나뿐이다 — 거기서만 조건 줄이 문장 **아래에** 한 겹 더 선다 */
function Choice({ mark, label, detail, disabled, onChoose }: { mark: string; label: string; detail: React.ReactNode; disabled?: boolean; onChoose: () => void }) {
  return (
    // 못 고르는 칸은 `disabled`가 말한다 — 핸들러 안에서 조용히 무시하면 멀쩡한 버튼이 고장으로 읽힌다
    <button className="choice" type="button" disabled={disabled} onClick={onChoose}>
      <span>{mark}</span><b>{label}</b><small>{detail}</small>
    </button>
  );
}

export function RestScreen({ decision, onAnswer }: {
  decision: MapDecision;
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
export function DemandScreen({ decision, onAnswer }: {
  decision: DemandDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  const penalty = view.penalty ? ` · ${godName(view.other)} 호의 −${Math.abs(view.penalty)}` : "";
  return (
    <Screen view={view}>
      {/**
       * 요구 화면은 글자만 있었다 — 신이 직접 말을 거는 자리인데 누가 말하는지가 화면에 없었다.
       * 일러 다섯은 이미 있고(`art/gods`) 이 계획은 에셋을 새로 만들지 않는다
       */}
      <GodSay god={view.patron}>{godLine(view.patron, "demand_offer", view.depth)}</GodSay>
      {view.tiers.map((tier) => {
        const [mark, name] = tierName[tier.action] ?? ["요", tier.action];
        return (
          <Choice
            key={tier.action}
            mark={mark}
            label={`${name} · 대가 ${costText(view.other, tier.cost)}`}
            // 보상은 다음 전투에서 조건을 지켰을 때만 들어간다 — 고르는 것만으로 주지 않는다
            detail={
              <>
                {tier.text}
                {/* 문장은 신의 목소리고 이 줄은 규칙이다 — 합치면 신이 숫자를 읽는 소리가 된다 */}
                <em className="rule">{tier.rule}</em>
                지키면 {rewardText(view.patron, tier.reward)}{penalty}
              </>
            }
            disabled={!decision.options.includes(tier.action)}
            onChoose={() => onAnswer(tier.action)}
          />
        );
      })}
      <Choice mark="거" label="거절 · 대가 없음" detail="어느 호의도 움직이지 않습니다. 거절에도, 지키지 못해도 벌금은 없습니다." onChoose={() => onAnswer("reject")} />
    </Screen>
  );
}

/**
 * 신탁 2택. 요구와 같은 꼴이지만 **거절할 「거절」이 없다** — 저울이라 한쪽을 올리면 반대쪽이
 * 내려가고, 「아무것도 안 움직인다」는 답이 이 화면에 없다. 전투 한가운데라 배지가 턴을 든다.
 *
 * 두 줄이 **기운 뒤의 값과 단계를 두 신 다** 적는다 — 「62 → 74 · 평온 → 헌신」과 그 대가가 같은
 * 줄에 서야 결정이 계산이 된다(요구 화면의 「대가가 앞에 선다」와 같은 규칙, R-26)
 */
export function OracleScreen({ decision, onAnswer }: {
  decision: OracleDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  const moved = (god: string, amount: number) => {
    const now = view.favor[god] ?? favorInitial;
    // 엔진의 `shiftFavor`와 같은 자리에서 자른다 — 화면이 100을 넘는 값을 약속하면 거짓말이 된다
    const next = Math.max(0, Math.min(favorPool, now + amount));
    const crossed = favorStage(next) !== favorStage(now);
    return `${godName(god)} ${now} → ${next} · ${crossed ? `${stageName[favorStage(now)]} → ${stageName[favorStage(next)]}` : stageName[favorStage(next)]}`;
  };
  const tilt = (toward: string, away: string, amount: number) => `${moved(toward, amount)} — ${moved(away, -amount)}`;
  return (
    <Screen view={view}>
      {/* 상주 힌트(「저울은 한 조우에 한 번…」)는 도움말(P-53)로 갔다 */}
      <GodSay god={view.god}>{godName(view.god)}의 신탁</GodSay>
      <Choice
        mark="따"
        label={`${godName(view.god)}에게 기운다 · +${oracleSwing}`}
        detail={tilt(view.god, view.other, oracleSwing)}
        onChoose={() => onAnswer("obey")}
      />
      <Choice
        mark="손"
        label={`${godName(view.other)}에게 기운다 · +${oracleSwing}`}
        detail={tilt(view.other, view.god, oracleSwing)}
        onChoose={() => onAnswer("refuse")}
      />
    </Screen>
  );
}

import type { CSSProperties } from "react";
import { favorInitial, favorStage, oracleSwing } from "../../core/favor.ts";
import { restHealing } from "../../core/map.ts";
import { favorPool, singleBet, watchDemand, type BetDecision, type CardView, type DemandDecision, type GraceDecision, type MapDecision, type OracleDecision, type RunView } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks, Prop } from "../shared/backdrop.tsx";
import { CardRow, effectText } from "../shared/card.tsx";
import { godArt, godName, stageName } from "../shared/header.tsx";

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

/**
 * 내기표. 다섯 자리(**조건 · 승부 카드 · 판돈 · 성공 · 실패**)를 언제나 유지한다 — 미선택 값도
 * 빈 자리로 남아야 고르는 동안 이웃이 안 밀린다(UI.md 제1규칙). 채워진 칸만 220ms 한 번 들어온다
 */
function BetSheet({ deposit, rule, card }: { deposit: number; rule?: string; card?: CardView }) {
  const rows: [string, string | undefined][] = [
    ["조건", rule],
    ["승부 카드", card && card.name],
    ["판돈", card ? `이번 전투 카드 보상 · 최대 체력 ${deposit}` : "이번 전투 카드 보상"],
    ["성공", card ? `카드 보상 · 호의 · 최대 체력 반환 · 「${card.name}」 강화` : "카드 보상 · 호의"],
    ["실패", card ? `카드 보상 없음 · 최대 체력 ${deposit} 영구 손실` : "카드 보상 없음"],
  ];
  return (
    <dl className="bet-sheet">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          {/* 빈 자리도 글자 하나를 세운다 — 컨테이너 높이가 선택에 따라 바뀌면 그것이 흔들림이다 */}
          <dd className={value ? "filled" : undefined}>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 내기표의 윗칸 — 경쟁하는 두 신이 조건을 하나씩 낸다. 답은 **신의 이름**이고 관망이 셋째다.
 * 적이 모자란 조우에서는 한 신의 칸이 아예 서지 않으므로 관측이 실어 온 제안만 그린다 (P-59)
 */
export function DemandScreen({ decision, onAnswer }: {
  decision: DemandDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  return (
    <Screen view={view}>
      {view.offers.map((offer) => (
        <Choice
          key={offer.action}
          /**
           * 신이 직접 말을 거는 자리인데 누가 말하는지가 화면에 없었다 — 이름 한 글자가 표식이고
           * 일러 다섯은 이미 있다(`art/gods`). 이 계획은 에셋을 새로 만들지 않는다
           */
          mark={godName(offer.god).slice(0, 1)}
          /**
           * 벌금은 **지금** 나가는 값이라 보상이 아니라 신 이름과 같은 줄에 선다 — 값이 앞에 서지
           * 않으면 결정이 계산이 되지 않는다(마감은 P-26). 보상은 그 아래 「지키면」이 든다
           */
          label={`${godName(offer.god)} · 대가 ${offer.penalty ? `${godName(offer.other)} 호의 −${Math.abs(offer.penalty)}` : "없음"}`}
          // 보상은 이 전투에서 조건을 지켰을 때만 들어간다 — 고르는 것만으로 주지 않는다
          detail={
            <>
              {offer.text}
              {/* 문장은 신의 목소리고 이 줄은 규칙이다 — 합치면 신이 숫자를 읽는 소리가 된다 */}
              <em className="rule">{offer.rule}</em>
              {view.quest
                ? <>달성할 때까지 유지 · 달성하면 {godName(offer.god)} 호의 +{offer.reward.favor} · 원하는 카드 1장</>
                : <>지키면 {godName(offer.god)} 호의 +{offer.reward.favor}</>}
            </>
          }
          disabled={!decision.options.includes(offer.action)}
          onChoose={() => onAnswer(offer.action)}
        />
      ))}
      <Choice mark="관" label="관망 · 판돈 없음" detail="어느 신에게도 걸지 않습니다. 카드 보상은 그대로 받습니다." onChoose={() => onAnswer(watchDemand)} />
      {!view.quest && <BetSheet deposit={view.deposit} />}
    </Screen>
  );
}

/**
 * 내기표의 아랫칸 — 덱에서 승부 카드 한 장을 건다. 후보가 덱 전체가 아니다: 상한에 닿은 카드·융합·피해를 못 주는
 * 카드는 「이 카드로 마지막 적 처치」가 성립하지 않아 죽어 있다(`sim/engine.ts`의 `betCandidates`)
 */
export function BetScreen({ decision, onAnswer }: {
  decision: BetDecision;
  onAnswer: (choice: string) => void;
}) {
  const view = decision.observation;
  const promise = view.promise;
  return (
    <Screen view={view} wide>
      {promise
        ? <GodSay god={promise.god}>{promise.text}</GodSay>
        : <h2>무엇을 걸까요?</h2>}
      <BetSheet deposit={view.deposit} rule={promise?.rule} />
      <CardRow cards={view.deck} options={decision.options} onSelect={onAnswer} value={(_, index) => String(index)} />
      <Choice
        mark="단"
        label={promise ? "이대로 건다 · 판돈 없음" : "지나친다 · 판돈 없음"}
        detail={promise ? "승부 카드를 걸지 않습니다. 최대 체력도 내려가지 않습니다." : "카드를 잠그지 않고 지나갑니다."}
        onChoose={() => onAnswer(singleBet)}
      />
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

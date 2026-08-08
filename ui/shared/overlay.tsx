import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { betDeposit } from "../../core/demands.ts";
import { favorBoundaries } from "../../core/favor.ts";
import { restHealing } from "../../core/map.ts";
import { deckSize, type CardView, type PromiseView } from "../../sim/engine.ts";
import { GameCard } from "./card.tsx";
import { godName, placeName } from "./header.tsx";

/**
 * 토큰 사전·도움말·덱·약속·시작 덱 설정이 같은 셸 하나를 쓴다. **네이티브 `<dialog>`다** —
 * focus trap·Esc·backdrop이 공짜라 라이브러리가 없다. 열림 상태는 여는 쪽(App)이 들고,
 * 이 컴포넌트는 열려 있는 동안만 산다. 게임 상태는 그대로다 — 엔진은 답을 기다리는 중이라 멈출 것도 없다
 */
export function Overlay({ title, wide, action, onClose, children }: {
  title: string;
  /** 덱만 920이다 — 한 줄 6장(140px 카드)이 서려면 680으로는 모자란다 */
  wide?: boolean;
  action?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // `showModal()`은 마운트 뒤에만 부를 수 있다 — top-layer로 올라가 `.shell`의 zoom 밖이다
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      className={`overlay${wide ? " wide" : ""}`}
      // Esc는 `<dialog>`의 cancel → close로 여기 온다 — 닫는 길 셋(Esc·바깥·×)이 전부 onClose 하나다
      onClose={onClose}
      // 바깥 클릭: backdrop 클릭의 target은 dialog 자신이다. 내용 클릭은 자식이 target이라 안 닫힌다
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <header className="overlay-head">
        <h2>{title}</h2>
        <span className="overlay-actions">
          {action}
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </span>
      </header>
      <div className="overlay-body">{children}</div>
    </dialog>
  );
}

/**
 * 도움말 여섯 항목 — P-54가 걷어낼 상주 설명문들의 새 집이다. 문장은 **기존 화면 것을 그대로 옮겼다**
 * (새로 쓰면 새로 검수해야 한다). 값 셋(경계·회복량·덱 크기)은 코드에서 읽는다 — 여기 박으면
 * 규칙이 바뀔 때 도움말만 옛 자리에 남는다
 */
const helpItems: [string, string][] = [
  ["목표", "두 신의 호의를 관리하며 지하에서 지상까지 12층을 돌파하세요. 갈림길·카드·대상·보상·휴식·은혜·요구를 전부 당신이 고릅니다. 룰 봇이 대신 정하는 것은 없습니다."],
  ["저울", `호의 ${favorBoundaries.devotion} 이상은 헌신, ${favorBoundaries.calm} 이상은 평온, ${favorBoundaries.anger} 이상은 분노, 그 아래는 진노입니다. 저울은 한 조우에 한 번 기웁니다. 합은 그대로고 한쪽이 오르면 반대쪽이 그만큼 내려갑니다 — 거절할 「거절」은 없습니다.`],
  ["은혜", "은혜는 카드 한 장이 아니라 그 슬롯의 모든 카드에 붙습니다. 슬롯당 하나이고, 바꿔도 tier는 남습니다."],
  ["내기표", "두 신이 이번 전투의 조건을 하나씩 냅니다. 하나를 고르면 상대 신의 호의가 그 자리에서 내려가고, 지키면 고른 신의 호의가 오릅니다."],
  ["승부 카드", `조건 위에 덱의 한 장을 더 겁니다. 판돈은 이번 전투의 카드 보상과 최대 체력 ${betDeposit}입니다. 그 카드로 마지막 적을 처치하면 판돈이 돌아오고 그 한 장이 강화됩니다.`],
  ["관망", "아무 편도 들지 않습니다. 판돈이 없고 카드 보상은 그대로 받습니다."],
  ["쉼터", `체력을 ${restHealing} 회복하거나 카드를 지웁니다. 얇은 덱이 핵심 카드를 더 자주 뽑습니다. 강화는 같은 카드 두 장 중 한 장만 키웁니다.`],
  ["시작 덱", `시작 덱은 언제나 ${deckSize}장입니다. 전투 보상에서 카드를 한 장 덱에 넣습니다 — 덱을 얇게 두려면 건너뛰세요. 조합 밖 신의 카드도 넣을 수 있지만 그 신의 호의는 아무것도 움직이지 않습니다.`],
];

export function HelpPanel() {
  return (
    <dl className="help-list">
      {helpItems.map(([term, text]) => (
        <div key={term}><dt>{term}</dt><dd>{text}</dd></div>
      ))}
    </dl>
  );
}

/** 읽기 전용 덱. 정렬·필터 없음, 뽑을 더미 순서도 안 보여준다 — 정보는 장수뿐이다 */
export function DeckPanel({ deck }: { deck: CardView[] }) {
  return (
    <div className="overlay-deck">
      {deck.map((card, index) => <GameCard key={`${card.id}-${index}`} cardId={card.id} card={card} />)}
    </div>
  );
}

/** 확정된 약속 하나. 값은 App이 관측 스트림에서 수집한 표시용 누적이지 게임 상태가 아니다 */
export type PromiseRecord = { god: string; rule: string; region: string; floor: number; settled: "kept" | "broken" };

const settledName = { kept: "지킴", broken: "깨짐" } as const;

/** 약속 저널 — 진행 중 → 지킴 → 깨짐 세 그룹. 진행 중은 지금 관측의 `promises` 그대로다 */
export function JournalPanel({ active, history }: { active: PromiseView[]; history: PromiseRecord[] }) {
  const ongoing = active.filter(({ settled }) => !settled);
  const groups: [string, ReactNode[]][] = [
    ["진행 중", ongoing.map(({ god, rule, current, target }) => (
      <p key={`${god}:${rule}`} className="promise" style={{ "--god-color": `var(--${god})` } as CSSProperties}>
        <b>{godName(god)}</b><span>{rule}</span><em>{current} / {target}</em>
      </p>
    ))],
    ...(["kept", "broken"] as const).map((outcome): [string, ReactNode[]] => [
      settledName[outcome],
      history.filter(({ settled }) => settled === outcome).map(({ god, rule, region, floor }, index) => (
        <p key={`${god}:${rule}:${index}`} className={`promise ${outcome}`} style={{ "--god-color": `var(--${god})` } as CSSProperties}>
          <b>{godName(god)}</b><span>{rule}</span><em>{placeName({ region, floor })}</em>
        </p>
      )),
    ]),
  ];
  return (
    <div className="journal">
      {groups.map(([name, lines]) => (
        <section key={name}>
          <h3>{name}</h3>
          {lines.length ? lines : <p className="hint">아직 없습니다.</p>}
        </section>
      ))}
    </div>
  );
}

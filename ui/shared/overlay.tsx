import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { interventionEveryTurns } from "../../core/favor.ts";
import { allCards, gods, type CardView, type PromiseView } from "../../sim/engine.ts";
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

/** 과업과 개입만 설명한다. 수치는 규칙에서 읽어 화면만 옛값에 남지 않게 한다 */
const helpItems: [string, string][] = [
  ["과업", "맵의 과업 칸에서 다음 판정 가능한 전투의 조건을 고릅니다. 달성한 뒤 전투에서 이기면 호의와 과업 카드 한 장을 추가로 얻습니다."],
  ["개입", `두 신이 2턴째부터 ${interventionEveryTurns}턴마다 현재 호의 단계에 맞춰 자동으로 행동합니다.`],
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

const cardFilters = ["all", ...gods, "fusion"];

export function CardCatalog() {
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? allCards : allCards.filter((card) => filter === "fusion" ? card.patronPair : card.patron === filter);
  return (
    <div className="card-catalog">
      <div className="god-legend" role="group" aria-label="카드 필터">
        {cardFilters.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={filter === kind}
            style={{ "--god-color": kind === "all" ? "#c6a969" : kind === "fusion" ? "#d1b9f0" : `var(--${kind})` } as CSSProperties}
            onClick={() => setFilter(kind)}
          >
            <i />
            {kind === "all" ? "전체" : kind === "fusion" ? "융합" : godName(kind)}
          </button>
        ))}
      </div>
      <DeckPanel deck={shown} />
    </div>
  );
}

/** 확정된 과업 하나. 값은 App이 관측 스트림에서 수집한 표시용 누적이지 게임 상태가 아니다 */
export type PromiseRecord = { god: string; rule: string; region: string; floor: number; settled: "kept" | "broken" };

/** 과업 저널 — 진행 중 → 달성 → 미달성 세 그룹 */
export function JournalPanel({ active, history }: { active: PromiseView[]; history: PromiseRecord[] }) {
  const ongoing = active.filter(({ settled }) => !settled);
  const groups: [string, ReactNode[]][] = [
    ["진행 중", ongoing.map(({ god, rule, current, target }) => (
      <p key={`${god}:${rule}`} className="promise" style={{ "--god-color": `var(--${god})` } as CSSProperties}>
        <b>{godName(god)}</b><span>{rule}</span><em>{current} / {target}</em>
      </p>
    ))],
    ...(["kept", "broken"] as const).map((outcome): [string, ReactNode[]] => [
      outcome === "kept" ? "달성" : "미달성",
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

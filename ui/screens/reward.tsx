import { useEffect, useState } from "react";
import { skipReward, type RewardDecision } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks } from "../shared/backdrop.tsx";
import { CardRow, GameCard } from "../shared/card.tsx";

/** 손패와 같은 컴포넌트로 그린다. 상태는 없다 — 그린 것은 전부 마지막 yield의 observation이다 */
export function RewardScreen({ decision, onAnswer }: {
  decision: RewardDecision;
  onAnswer: (choice: string) => void;
}) {
  const { options, observation: view } = decision;
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const pages = Math.ceil(view.cards.length / pageSize);
  useEffect(() => setPage(0), [options]);
  const shown = view.cards.slice(page * pageSize, (page + 1) * pageSize);

  return (
    // 패널이 하나뿐이라 `run-layout`(2열)을 쓰면 오른쪽 607px가 빈 채로 남는다 — 휴식·요구·은혜와 같은 1열이다
    <>
      <Backdrop src={backdropArt(view.region, "combat")} tone="dim" />
      <div className="shell run">
        <Flanks region={view.region} depth={view.depth} />
        {/* 제목도 힌트(「카드를 한 장 덱에…」→ 도움말)도 없다(P-54) — 3택1 자체가 화면을 말한다 */}
        <div className="decision-panel solo">
          {/**
            * 승부 정산 — **결과 확인 연출이지 새 phase가 아니다**(P-59 §5). 성공한 조우에만 실려 오고
            * 입력을 막지 않는다. 축소 모션에서는 뒤집기가 없고 강화된 카드와 문장만 즉시 선다
            */}
          {view.settled && (
            <div className="bet-settled">
              <b>승부 성공</b>
              <div>
                <GameCard cardId={view.settled.before.id} card={view.settled.before} />
                <em aria-hidden="true">→</em>
                <GameCard cardId={view.settled.after.id} card={view.settled.after} />
              </div>
            </div>
          )}
          <CardRow cards={shown} options={options} onSelect={onAnswer} />
          {view.quest && (
            <div className="reward-pages">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
              <span>{page + 1} / {pages}</span>
              <button type="button" disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>다음</button>
            </div>
          )}
          {!view.quest && <button type="button" onClick={() => onAnswer(skipReward)}>건너뛰기</button>}
        </div>
      </div>
    </>
  );
}

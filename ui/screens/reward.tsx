import { skipReward, type RewardDecision } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks } from "../shared/backdrop.tsx";
import { CardRow } from "../shared/card.tsx";

/** 손패와 같은 컴포넌트로 그린다. 상태는 없다 — 그린 것은 전부 마지막 yield의 observation이다 */
export function RewardScreen({ decision, onAnswer }: {
  decision: RewardDecision;
  onAnswer: (choice: string) => void;
}) {
  const { options, observation: view } = decision;

  return (
    // 패널이 하나뿐이라 `run-layout`(2열)을 쓰면 오른쪽 607px가 빈 채로 남는다 — 휴식·요구·은혜와 같은 1열이다
    <>
      <Backdrop src={backdropArt(view.region, "combat")} tone="dim" />
      <div className="shell run">
        <Flanks region={view.region} depth={view.depth} />
        {/* 제목도 힌트(「카드를 한 장 덱에…」→ 도움말)도 없다(P-54) — 3택1 자체가 화면을 말한다 */}
        <div className="decision-panel solo">
          <CardRow cards={view.cards} options={options} onSelect={onAnswer} />
          <button type="button" onClick={() => onAnswer(skipReward)}>건너뛰기</button>
        </div>
      </div>
    </>
  );
}

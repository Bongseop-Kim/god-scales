import { skipReward, type RewardDecision } from "../sim/engine.ts";
import { CardRow } from "./card.tsx";
import { RunHeader } from "./header.tsx";

/** 손패와 같은 컴포넌트로 그린다. 상태는 없다 — 그린 것은 전부 마지막 yield의 observation이다 */
export function RewardScreen({ seed, decision, onAnswer }: {
  seed: number;
  decision: RewardDecision;
  onAnswer: (choice: string) => void;
}) {
  const { options, observation: view } = decision;

  return (
    // 패널이 하나뿐이라 `run-layout`(2열)을 쓰면 오른쪽 607px가 빈 채로 남는다 — 휴식·요구·은혜와 같은 1열이다
    <div className="shell">
      <RunHeader seed={seed} view={view} title="전투 보상" badge={`덱 ${view.deck}장`} />

      <div className="decision-panel">
        <p className="hint" role="status">카드를 한 장 덱에 넣습니다. 덱을 얇게 두려면 건너뛰세요.</p>
        <CardRow cards={view.cards} options={options} onSelect={onAnswer} />
        <button type="button" onClick={() => onAnswer(skipReward)}>건너뛰기</button>
      </div>
    </div>
  );
}

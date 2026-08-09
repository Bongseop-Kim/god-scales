import { favorDecayPerEncounter, favorInitial } from "../../core/favor.ts";
import { skipReward, type RewardDecision } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks } from "../shared/backdrop.tsx";
import { CardRow } from "../shared/card.tsx";
import { godName } from "../shared/header.tsx";

/** 손패와 같은 컴포넌트로 그린다. 상태는 없다 — 그린 것은 전부 마지막 yield의 observation이다 */
export function RewardScreen({ decision, onAnswer }: {
  decision: RewardDecision;
  onAnswer: (choice: string) => void;
}) {
  const { options, observation: view } = decision;
  return (
    // 패널이 하나뿐이라 `run-layout`(2열)을 쓰면 오른쪽 607px가 빈 채로 남는다 — 휴식·과업·은혜와 같은 1열이다
    <>
      <Backdrop src={backdropArt(view.region, "combat")} tone="dim" />
      <div className="shell run">
        <Flanks region={view.region} depth={view.depth} />
        {/* 제목도 힌트(「카드를 한 장 덱에…」→ 도움말)도 없다(P-54) — 3택1 자체가 화면을 말한다 */}
        <div className="decision-panel solo">
          {view.questReward && view.questResult && (
            <p className="quest-result">
              <b>과업 달성 · {godName(view.questResult.god)}</b>
              <span>{view.questResult.rule}</span>
              <em>{view.questResult.current} / {view.questResult.target}</em>
            </p>
          )}
          {/**
            * 조우 정산 — `finale`(정산 전 마지막 관측)과 지금 favor의 차가 곧 감쇠·방치다.
            * 감쇠보다 더 내렸으면 그 신의 카드를 한 장도 안 낸 것이다 — 규칙이 여기서 학습된다
            */}
          {view.finale && (
            <p className="favor-drift" title="조우가 끝나면 호의가 내리고, 카드를 내지 않은 신의 호의는 더 내립니다.">
              <b>호의</b>
              {view.patrons.map((god) => {
                const delta = (view.favor[god] ?? favorInitial) - (view.finale!.favor[god] ?? favorInitial);
                return (
                  <span key={god}>
                    {/* 양수도 온다 — 진노 신을 꺾으면 호의가 평온 하한으로 돌아온다(화해) */}
                    {godName(god)} <em className={delta < 0 ? "loss" : undefined}>{delta > 0 ? `+${delta}` : delta}</em>{delta < favorDecayPerEncounter && " · 쓰지 않음"}
                  </span>
                );
              })}
            </p>
          )}
          <CardRow cards={view.cards} options={options} onSelect={onAnswer} />
          <button type="button" onClick={() => onAnswer(skipReward)}>건너뛰기</button>
        </div>
      </div>
    </>
  );
}

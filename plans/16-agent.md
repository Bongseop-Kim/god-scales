# P-16 · LLM 에이전트 — 전략 층

`plans/16-agent.md` · [◀ P-15](15-tune.md) · [색인](00-index.md) · [P-17 ▶](17-ui.md)

**크기** 김 · **착수 조건** P-15

---

## 완료 정의

10런이 완주하고 `agent_fallbacks`가 전체 판단의 10% 미만이다. 두 주체의 `fusion_rate`와 라이벌 조합 격차가 나란히 리포트에 나온다.

```bash
npm run sim -- --actor llm_agent --run-id 001
#   → 판단 지점에서 decisions/001/pending.json 을 쓰고 멈춘다
#   → Claude Code 가 읽고 decisions/001/answer.json 을 쓴다
npm run sim -- --actor llm_agent --run-id 001 --resume

npm run report -- --compare rule_bot llm_agent
```

---

## 산출

```
sim/bots/llm.ts       전략 판단 지점, 관측 직렬화, 폴백
sim/handoff.ts        pending / answer 파일 핸드셰이크
decisions/            런별 판단 기록 (상태 · 선택 · 이유)
sim/report.ts         runs_by_actor 비교, 주체별 fusion_rate
```

---

## 판단 지점 — 전략 층만

전투 내 카드 순서와 대상 선택은 룰 봇 v1에게 맡긴다.

| 판단 지점 | 런당 횟수 |
|---|---|
| 신 조합 선택 | 1 |
| 조우 진입 전략 — 요구 만족 여부, 어느 신을 밀 것인가, 합성을 노릴 것인가 | 8~12 |
| 상충 요구 선택 | 0~2 |
| 층 경로 선택 (3·5층) | 4 |
| 휴식 선택 | 0~4 |
| 전투 보상 선택 | 8~12 |
| 은총 마일스톤 대상 선택 | 0~3 |
| | **합 ~30** |

---

## 파일 핸드셰이크

```
decisions/001/
  pending.json    { turn, phase, observation, options[] }
  answer.json     { choice, reason }
  log.jsonl       판단 전체 누적
```

`observation`은 사람이 보는 정보 범위로 직렬화한다(T-8) — 호의 수치와 단계, 적별 의도, 제시된 요구, 남은 층, 현재 덱.

`decisions/`를 `replay_mode: action_log`로 표시해 보관한다(I-2).

**폴백** — 파싱 실패, 무효 선택, 응답 없음이면 룰 봇 판단으로 대체하고 `agent_fallbacks`를 올린다.

---

## 지시

- **한 런은 한 세션 안에서 끝낸다.** 세션이 바뀐 런은 비교 대상에서 뺀다(A-6.2)
- `answer.json`의 `reason` 필드에 선택 이유를 담는다(T-8)
- **리포트에 "에이전트는 전략 층만 근사한다"는 분담을 명시한다.** 전투 층 체감은 사람 플레이테스트가 답한다
- 런 수를 늘려야 하면 모델을 낮추지 말고 A-6.5의 조건을 확인한다
- 부족한 부분은 시나리오 주입(`fused_deck` `grace_6` `both_devotion`)으로 보완한다

---

## 판정

| 관측 | 대응 |
|---|---|
| `fusion_rate`가 두 주체에서 비슷하다 | 합성 조건을 조인다 |
| 라이벌 조합 격차가 두 주체에서 좁혀지지 않는다 | R-4의 설계를 재검토한다 |

**참조** — T-8, T-6 ④, T-9.2, I-2, A-6.3

---

## 세션 종료

- [ ] 10런 완주
- [ ] `agent_fallbacks` 10% 미만
- [ ] 두 주체 `fusion_rate` 격차 기록
- [ ] `decisions/` 보관 (이유 로그 포함)
- [ ] 리포트에 층 분담 명시
- [ ] 커밋

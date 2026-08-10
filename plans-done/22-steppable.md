# P-22 · 엔진 스텝화

`plans/22-steppable.md` · [◀ P-21](21-assets.md) · [색인](00-index.md) · [P-23 ▶](23-play.md)

**크기** 보통 · **착수 조건** P-19

여기서는 화면을 만들지 않는다. **엔진이 결정 지점에서 멈출 수 있는가**를 검증한다.

---

## 왜

`sim/engine.ts:run()`은 12층을 한 호출에 다 돌린다. 카드·타겟·휴식을 전부 `sim/bots/rule.ts`가 안에서 정하고 결과만 돌려준다. 그래서 사람은 갈림길 4개만 고를 수 있다. LLM 에이전트도 같은 한계에 걸려 `path`만 답하고(`sim/handoff.ts`의 `phase`가 `patron_pair | path`뿐이다) 전투는 봇에게 맡긴다.

**멈출 수 있는 루프가 없다는 것이 UI의 상한이다.** 화면부터 만지면 이 벽을 화면 쪽에서 다시 만난다.

---

## 완료 정의

리팩터가 **아무것도 바꾸지 않았음**을 세 줄로 확인한다.

```bash
npm test
#   → 51테스트 통과
npm run sim -- --replay logs/human/*.json
#   → 40개 기존 런의 승패 · 도달 층 · 최종 호의가 전과 동일
npm run sim -- --runs 2000 --stratified
#   → 승률 61.7% · 블록 효율 0.807 · 합성률 10.4% 그대로
```

세 번째가 이 세션의 진짜 게이트다. P-13 동결(`bot_policy_version=v2`, `global_param_version=v1`)을 깨지 않았다는 뜻이다.

---

## 산출

```
sim/engine.ts   run() → runSteps() 제너레이터 + run() 얇은 래퍼
sim/replay.ts   ReplayAction에 card · rest 추가
```

---

## 형태

`run()`의 while 루프를 제너레이터로 바꾸고, 봇 호출 자리마다 `yield`한다.

```ts
export function* runSteps(seed, scenario?, patrons?): Generator<Decision, RunResult, string> {
  // ...
  const choice = yield { phase: 'card', options: affordableIds, observation: { hp, energy, hand } }
}

export function run(seed, scenario?, actions = [], patrons?): RunResult {
  // 봇이 답을 채우는 드라이버. 기존 시그니처와 반환값이 그대로다
}
```

- **`run()`의 시그니처와 반환값을 바꾸지 않는다.** `sim/runner.ts` · `tools/tune.ts` · `sim/heatmap.ts` · `ui/app.tsx`가 그대로 돌아야 한다
- 결정론은 구조로 보장한다 — 봇도 사람도 **같은 제너레이터**를 통과한다. 봇 정책을 복사하지 않는다
- `async`로 만들지 않는다. 제너레이터는 멈추는 데 `await`가 필요 없고, `core/`의 순수성 테스트(P-01)도 그대로 통과한다

---

## action log는 부분 덮어쓰기다

지금 `run()`은 `scriptedActions[i] ?? choosePath(...)`로 동작한다. **이 성질을 유지한다.**

| 로그에 있는 결정 | 로그에 없는 결정 |
|---|---|
| 그대로 재생 | 봇이 채운다 |

`logs/human/`의 40개 런과 `decisions/`의 10개 에이전트 런은 `path`만 갖고 있다. 이 성질이 있어야 그 50개가 카드 액션 추가 후에도 그대로 재생된다. 완료 정의의 두 번째 명령이 이것을 검사한다.

---

## 결정 지점

| phase | 지금 정하는 것 | 스텝화 후 |
|---|---|---|
| `path` | `choosePath` (이미 사람이 고름) | 유지 |
| `card` | `chooseCard` | yield |
| `target` | `chooseTarget` | yield |
| `rest` | `chooseRest` | yield |
| `rest_card` | `chooseRestCard` | yield |

요구(`resolveDemand`)와 은총(`applyMilestones`)은 **봇 결정이 아니라 자동 처리**다. 지금 손대지 않는다 — 선택지로 올리는 것은 규칙 작업이고 P-23 뒤로 뺀다.

---

## 지시

- 리팩터 커밋과 기능 커밋을 섞지 않는다. 이 세션은 **동작이 한 톨도 바뀌지 않는** 커밋 하나다
- 2000런 지표가 어긋나면 임계값을 조정하지 말고 **되돌린다.** 어긋났다는 것은 결정 순서나 RNG 소비 순서가 바뀌었다는 뜻이다
- `ReplayAction`에 필드를 늘릴 때 `replay_mode`는 `action_log` 그대로 둔다. 형식 버전을 올릴 만한 변경이 아니다

**참조** — I-3, R-8.2, P-13 동결, `sim/handoff.ts`

---

## 세션 종료

- [ ] `npm test` 51테스트 통과
- [ ] 기존 40개 replay 재생 결과 동일
- [ ] 2000런 지표 3종 동일
- [ ] `run()` 호출부 무수정
- [ ] `reviews/22-steppable.md`
- [ ] 커밋

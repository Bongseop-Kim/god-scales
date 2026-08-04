# N-01 · 엔진 스텝화

`plans/01-steps.md` · [N-02 ▶](02-combat.md)

**크기** 보통 · **착수 조건** 없음 · **선행** `npm install`

여기서는 화면을 만들지 않는다. **엔진이 결정 지점에서 멈출 수 있는가**를 검증한다.

---

## 왜

`sim/engine.ts:run()`의 `while (state.map.node < 12)` 루프가 12층을 한 호출에 다 돈다. 카드·타겟·휴식·제거 카드를 전부 `sim/bots/rule.ts`가 루프 안에서 정하고 `RunResult`만 돌려준다. 밖에서 끼어들 자리는 `scriptedActions`로 갈림길을 덮어쓰는 것뿐이다.

**멈출 수 있는 루프가 없다는 것이 UI의 상한이다.** 화면부터 만지면 이 벽을 화면 쪽에서 다시 만난다.

---

## 완료 정의

리팩터가 **아무것도 바꾸지 않았음**을 세 줄로 확인한다.

```bash
npm install
npm test
#   → 17파일 51테스트 통과 (freeze.test.ts 포함)
npm run sim -- --replay logs/human/*.json
#   → logs/human/ 19개 런의 승패 · 도달 층 · 최종 호의가 전과 동일
npm run sim -- --runs 2000 --stratified
#   → win_rate=0.617  block_efficiency=0.807  fusion_rate=0.104  그대로
```

세 번째가 이 세션의 진짜 게이트다. P-13 동결(`bot_policy_version=v2`, `global_param_version=v1`)을 깨지 않았다는 뜻이다.

**먼저 리팩터 전에 위 세 줄을 돌려 숫자를 리뷰 초안에 적어둔다.** 비교 대상이 없으면 게이트가 아니다.

---

## 산출

```
sim/engine.ts   run() → runSteps() 제너레이터 + run() 얇은 래퍼
sim/replay.ts   ReplayAction 에 card · target · rest · rest_card 추가
```

---

## 형태

`while` 루프를 제너레이터로 옮기고, 봇 호출 자리마다 `yield`한다.

```ts
export type Decision = {
  phase: "path" | "card" | "target" | "rest" | "rest_card";
  options: string[];
  observation: Record<string, unknown>;
};

export function* runSteps(seed: number, scenario?: Scenario, patrons?: PatronPair): Generator<Decision, RunResult, string> {
  // ...
  const choice = yield { phase: "card", options: affordableIds, observation: { hp, energy, hand } };
}

export function run(seed: number, scenario?: Scenario, actions: ReplayAction[] = [], patrons?: PatronPair): RunResult {
  // 제너레이터를 돌리며 봇이 답을 채우는 드라이버. 기존 시그니처와 반환값이 그대로다
}
```

- **`run()`의 시그니처와 반환값을 바꾸지 않는다.** `sim/runner.ts` · `sim/play.ts` · `tools/tune.ts` · `sim/heatmap.ts` · `ui/app.tsx` · `test/*.test.ts`가 무수정으로 돌아야 한다
- 결정론은 구조로 보장한다 — 봇도 사람도 **같은 제너레이터**를 통과한다. 봇 정책을 UI 쪽으로 복사하지 않는다
- `async`로 만들지 않는다. 제너레이터는 멈추는 데 `await`가 필요 없고, `core/`의 순수성 테스트(`test/purity.test.ts`)도 그대로 통과한다
- `observation`에는 **봇이 이미 읽는 값만** 담는다. 적 의도는 `sim/bots/rule.ts:intent()`가 읽으므로 담아도 된다(N-02가 이걸 그린다)

---

## action log는 부분 덮어쓰기다

지금 `run()`은 `scripted?.choice ?? choosePath(...)`로 동작한다. **이 성질을 유지한다.**

| 로그에 있는 결정 | 로그에 없는 결정 |
|---|---|
| 그대로 재생 | 봇이 채운다 |

`logs/human/`의 19개 런과 `decisions/`의 10개 에이전트 런은 `path`만 갖고 있다. 이 성질이 있어야 그 29개가 카드 액션 추가 후에도 그대로 재생된다. 완료 정의의 두 번째 명령이 이것을 검사한다.

**`ReplayAction`을 유니온으로 넓힐 때 `type` 필드로 분기한다.** `actionIndex` 하나를 순서대로 소비하는 지금 구조에서, 로그에 없는 `phase`가 나왔을 때 인덱스를 넘겨 쓰지 않도록 **phase가 일치할 때만 소비한다.**

```ts
const scripted = scriptedActions[actionIndex]?.type === phase ? scriptedActions[actionIndex++] : undefined;
```

---

## 결정 지점

| phase | 지금 | 스텝화 후 |
|---|---|---|
| `path` | `choosePath` (이미 사람이 고른다) | 유지 + yield |
| `card` | `chooseCard` | yield |
| `target` | `chooseTarget` | yield |
| `rest` | `chooseRest` | yield |
| `rest_card` | `chooseRestCard` | yield |

`resolveDemand`와 `applyMilestones`는 **봇 결정이 아니라 자동 처리**다. 지금 손대지 않는다 — 선택지로 올리는 것은 규칙 작업이고 N-05다.

카드 보상은 아직 없다. `phase: "reward"`를 미리 만들지 않는다 — N-04가 규칙과 함께 넣는다.

---

## 지시

- 리팩터 커밋과 기능 커밋을 섞지 않는다. 이 세션은 **동작이 한 톨도 바뀌지 않는** 변경이다
- 2000런 지표가 어긋나면 임계값을 조정하지 말고 **되돌린다.** 결정 순서나 RNG 소비 순서가 바뀌었다는 뜻이다. `createRng(seed * 100 + node)` 호출 지점과 `shuffle` 호출 횟수를 먼저 본다
- `replay_mode`는 `action_log` 그대로 둔다. 형식 버전을 올릴 만한 변경이 아니다

**참조** — I-3, R-8.2, P-13 동결, `sim/handoff.ts`

---

## 세션 종료

- [ ] `npm test` 51테스트 통과
- [ ] `logs/human/` 19개 replay 결과가 리팩터 전과 동일
- [ ] 2000런 지표 3종 동일 (전/후 숫자를 리뷰에 나란히 적는다)
- [ ] `run()` 호출부 무수정
- [ ] `reviews/01-steps.md`

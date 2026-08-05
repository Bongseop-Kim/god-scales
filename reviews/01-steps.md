# N-01 리뷰 · 엔진 스텝화

판정: 통과. 동작이 한 톨도 바뀌지 않았다.

## 게이트 전/후

| 항목 | 전 | 후 |
|---|---|---|
| `npm test` | 17파일 51테스트 | 18파일 54테스트 (`test/steps.test.ts` 추가) |
| `logs/human/*.json` replay | win_rate=0.353 block_efficiency=0.779 favor_floor={"zeus":48,"athena":0} | 출력 전체 바이트 동일 |
| 2000런 stratified | win_rate=0.617 block_efficiency=0.807 fusion_rate=0.104 | 출력 전체 바이트 동일 |

replay·2000런은 지표만 대조한 게 아니라 리포트 전문을 `diff`했고 차이가 없었다. `bot_policy_version=v2`, `global_param_version=v1` 그대로다.

## 한 것

- `run()` 본문이 `runSteps()` 제너레이터로 이동했다. 봇 호출 자리 5곳(`path`·`card`·`target`·`rest`·`rest_card`)이 `yield`가 됐다.
- `playEncounter()`도 제너레이터가 되어 `yield*`로 위임된다. RNG 호출 지점과 횟수는 그대로다.
- `run()`은 제너레이터를 봇 기본값으로 끝까지 돌리는 12줄 드라이버다. 시그니처·반환값 불변, 호출부(`runner.ts`·`play.ts`·`heatmap.ts`·`tune.ts`·`ui/app.tsx`·테스트) 무수정.
- `ReplayAction`을 `type` 태그 유니온으로 넓혔다. 드라이버는 `scriptedActions[i]?.type === phase`일 때만 인덱스를 소비하므로 path만 있는 기존 29개 로그가 그대로 재생된다.

## 계획과 다른 점 하나

`Decision`에 `bot: string` 필드를 하나 더 뒀다. yield 지점에서 엔진이 봇 답을 같이 계산해 내보낸다.

이유: 드라이버가 봇을 직접 부르려면 `combat`·`cardMap`·`enemyMap`·`favor` 산 객체를 `observation`으로 밖에 흘려야 하고, phase별 분기(정책 배선)가 드라이버에 생긴다. `bot`을 함께 내보내면 봇 호출문이 **원래 있던 자리에서 한 글자도 움직이지 않아** 결정론이 구조로 보장되고, 드라이버는 `scripted?.choice ?? step.value.bot` 한 줄이 된다. N-02의 UI도 정책을 복사하지 않고 추천 수를 공짜로 얻는다. 봇 함수는 전부 순수하고 배열을 복사해 정렬하므로 사람이 답할 때 미리 계산해도 상태가 오염되지 않는다.

`card` phase의 턴 종료는 `endTurnAction = "end_turn"`을 `options` 끝에 넣어 표현했다. 선택지 목록이 완전해야 UI가 따로 판단할 게 없다.

## 알게 된 것

봇은 쉼터에서 `remove`를 절대 고르지 않는다 — `choosePath`는 hp<50%에서만 쉬고 `chooseRest`는 hp≥70%에서만 제거를 고른다. 2000런 `rest_choices={"heal":2610}`이 그 증거다. 즉 `chooseRestCard`는 사람이 조작할 때만 닿는 경로다. 새 테스트가 `rest`에 `remove`를 직접 넣어 그 지점을 지난다.

## 안 한 것

- `phase: "reward"` 미생성 (N-04), `resolveDemand`·`applyMilestones`는 자동 처리 유지 (N-05).
- `RunResult.actions`는 path만 기록한다. 카드 액션까지 로그에 남기는 건 반환값 변경이라 N-02 몫이다.
- `logs/human/`은 19개가 아니라 17개(`run-31`~`run-47`)다. 계획서의 19는 실제와 다르다.

# N-02 리뷰 · 사람이 카드를 낸다

판정: 통과. 브라우저에서 카드를 직접 내며 1런을 끝내고, 반출 JSON을 `--replay`가 같은 결과로 재생했다.

## 게이트

`aside repl`로 dev 서버(`localhost:5173`)를 몰아 완주했다. 크레딧을 쓰는 브라우저 에이전트가 아니라 `repl`의 DOM 자동화라 402에 걸리지 않았다.

| 항목 | 브라우저 | `--replay logs/human/run-play-1.json` |
|---|---|---|
| 승패 | 패배 | `wins=0` |
| 도달 층 | 7/12층 | `hp_curve` 8칸 = 7층 |
| 최종 체력 | 0 | `hp_curve` 마지막 0 |
| 전투 횟수 | 7 | `enemy_count_dist` 합 7 |
| 최종 호의 | 제우스 97 · 아테나 26 | `{"zeus":97,"athena":26}` |

반출된 244개 액션 구성: `card` 153 · `target` 89 · `path` 2. **휴식은 로그에 없다** — 봇이 채웠고, 재생 때 봇이 같은 값을 다시 채운다(N-01 부분 덮어쓰기).

- `npm test`: 18파일 56테스트 통과. `test/ui.test.ts`에 손으로 싸운 런 재생 케이스 추가(`card`·`target` 포함, `rest` 미포함, 봇 런과 다른 카드열임을 함께 확인), `test/steps.test.ts`에 피해 관측값 케이스 추가.
- `npm run build` 통과, `npx tsc --noEmit` 통과.
- 2000런 stratified: `win_rate=0.617 block_efficiency=0.807 fusion_rate=0.104` — P-13 동결 그대로. observation 필드를 늘린 것이 RNG를 건드리지 않았다.
- `ui/`에 `localStorage`·`IndexedDB`·`sessionStorage`·`document.cookie` 문자열 없음.

## 잡은 버그 하나 — 퇴장 애니메이션의 stale 클로저

첫 자동 완주 시도가 `Uncaught Error: Card is not in hand: guard`로 죽고 앱이 초기 화면으로 되돌아갔다.

원인: `AnimatePresence`는 손패에서 빠진 카드를 exit 동안 마운트한 채 둔다. 그 버튼의 `onClick`은 **옛 `pending`을 클로저에 들고 있어서**, 이미 지나간 결정의 선택지를 제너레이터에 밀어넣는다. `pending.options.includes(choice)` 검사도 옛 options를 보므로 통과해버린다.

고침: 최신 결정을 `useRef`(`latest`)에 함께 들고, 판정과 액션 기록을 **ref 값으로** 한다. state의 `pending`은 그리기 전용이다. 실제 사람도 카드가 사라지는 160ms 동안 같은 자리를 두 번 누를 수 있으므로 이건 자동화 전용 문제가 아니었다.

## 형태

- `ui/app.tsx`가 드는 것은 제너레이터 핸들(`useRef`)·마지막 yield·반출용 액션 목록뿐이다. 화면 종류도 state가 아니라 `pending.phase`에서 파생한다. HP·에너지·손패·적 상태는 전부 `observation`을 그린 것이다.
- `rest`·`rest_card`는 `advance()`가 `bot` 값으로 즉시 넘긴다(N-05까지). 답을 채우지 않았으니 로그에도 남지 않는다.
- `MapPanel`이 `actions`를 위치로 인덱싱하던 것을 고쳤다 — 액션 배열에 카드가 섞이면서 `actions[2]`가 더는 세 번째 갈림길이 아니다. 지금은 `path` 액션만 걸러 넘긴다.
- N-01의 `Decision`을 `CombatDecision | MapDecision` 판별 유니온으로 좁혔다. UI가 `phase`로 좁히면 `observation` 타입이 따라오므로 캐스트가 없다.
- `observation`에 `draw`(남은 뽑을 카드)·`node`·손패의 이름·비용을 넣었다. 비용은 은총 강화로 런 중에 바뀌므로 UI가 `data/cards.json`을 따로 읽으면 두 번째 진실이 된다.

## 재사용만 했다

`GameCard`에 `onSelect`가 오면 `<button>`, 없으면 기존 `<article>`로 렌더한다(결과 화면 그대로). `TokenBadge`를 `TokenRow`로 한 번 감싸 플레이어·적 토큰에 같이 쓴다. 손패 퇴장은 Motion의 `exit`, 카드 press와 HP 바는 `--ease-out` CSS transition. 새 애니메이션 규격도 새 에셋도 없다.

## 피해 숫자 팝 (A-2.6 400ms)

UI가 이전 HP를 기억하지 않는다. **엔진이 피해를 관측값으로 실어 보낸다** — `playCard`와 `endTurn` 앞뒤로 체력을 재서 `observation.hits`(`{ id, amount }`, `id`는 적 id 또는 `player`)에 담는다. 매 yield는 "지난 결정 이후 깎인 체력"을 들고 오므로 진실은 여전히 엔진 하나다.

`hitSeq`가 새 피해에서만 오르고 UI가 그것을 `key`로 쓴다. 그래서 같은 피해가 card → target 두 결정에 걸쳐 두 번 튀지 않고, 새 피해는 다시 튄다. 브라우저 확인: 창 공격 뒤 적 위에 `-6.9`, 턴 종료 뒤 플레이어 쪽에 `-7`(체력 93/100). 적의 의도 표시와 겹치지 않게 카드 아래쪽에서 떠오른다. `prefers-reduced-motion`이면 움직임 없이 숫자만 남긴다.

죽은 적은 `observation.enemies`에서 빠지므로 **마지막 일격의 숫자는 뜨지 않는다.** 시체를 남기는 것은 전투 표현 작업이라 여기서 하지 않았다.

## 안 한 것 / 알아둘 것

- 적 `intent_visible`은 `data/enemies.json`에서 UI가 직접 읽는다(적 이름도 거기서 온다). 지금 7마리 모두 `true`라 가려지는 적은 없지만, false가 들어오면 "의도 감춤"으로 나간다.
- 체력·방어가 `5.9`처럼 소수로 보인다. `baseCardBalance = -0.1` 때문이며 엔진의 실제 값이다. 표시용 반올림은 상태를 속이는 것이라 하지 않았다.
- 자동화는 "누를 수 있는 첫 카드"를 누르는 최악의 정책이라 7층에서 죽는다. 승리 런이 필요하면 사람이 직접 눌러야 한다.
- `logs/human/`에 `run-play-1.json`이 하나 늘어 18개다. N-01의 replay 게이트를 다시 돌릴 때 기준 숫자가 17개 시절과 다르다.
- 엔진 예외가 나면 React 루트가 초기 화면으로 되돌아간다. 에러 경계는 이 세션 범위가 아니다.

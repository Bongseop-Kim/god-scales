# P-52 · app.tsx 화면 분리

관련 [R-43](../reviews/43-shell.md) · [R-26](../reviews/26-hud.md)

## 배경

`ui/`의 관례는 이미 **화면 하나 = 파일 하나**다 — `choices.tsx`(휴식·은혜·요구·신탁),
`reward.tsx`, `combat.tsx`, `stats.tsx`가 그렇다. 이탈은 `app.tsx` 하나다: 671줄에
셸(App·라우팅)과 화면 넷(인트로·시작·지도·결과)이 같이 산다. 지도 격자를 고치려고 열면
덱 편집기가 같이 스크롤되고, `test/ui.test.ts`도 `MapPanel`을 앱 셸에서 꺼내 쓴다.

리팩토링이지 재설계가 아니다 — **함수를 자르지도 합치지도 않고, 파일만 옮긴다.**

## 원칙

- 순수 이동. 옮기는 함수의 본문·주석·시그니처는 한 글자도 안 바뀐다. diff는 import 줄과
  파일 경계뿐이어야 한다.
- 재수출(배럴) 금지. `app.tsx`가 옮긴 것을 다시 내보내면 같은 심볼에 경로가 둘 생긴다 —
  `test/ui.test.ts`의 import를 새 경로로 바꾸는 것이 한 경로다.
- 새 컴포넌트·새 훅·새 추상화 없음. 나누면서 「김에」 고치는 것도 없음.

## 단계

### 1. hero 아트를 `backdrop.tsx`로

`heroArt` glob과 `hero()` 두 줄을 `backdrop.tsx`로 옮겨 내보낸다 — 배경 그림의 집은
이미 거기다(`backdropArt`). 인트로·시작·결과 셋이 쓰므로 어느 화면 파일에 두어도
남 집 살이가 된다.

### 2. `ui/map.tsx` (신규, ~150줄)

`MapScreen` · `MapPanel` · `takenLanes` · `laneName` · `nodeLabel` · `nodeDetail` ·
`markerTransition`. 결과 화면이 `MapPanel`·`takenLanes`를 여기서 import한다.

### 3. `ui/setup.tsx` (신규, ~220줄)

`IntroScreen` · `SetupScreen` · `DeckEditor` · `SplitField` · `FullscreenButton` ·
`cardIndex`. `FullscreenButton`은 셸(App)과 인트로가 같이 쓴다 — `app.tsx`에 남기면
setup → app import가 생겨 순환이 되므로 여기 두고 `app.tsx`가 가져간다.

### 4. `ui/result.tsx` (신규, ~90줄)

`ResultScreen` · `Summary`. `MapPanel`·`takenLanes`는 2에서, `hero`는 1에서 온다.

### 5. `app.tsx` 정리 (~230줄)

남는 것: `App` · `patronPair` · `screens` · `screenTransition`. 셸이 화면을 고르는
일만 남는다 — `combat.tsx`를 import하는 것과 같은 꼴로 넷을 import한다.

### 6. import 갱신

`test/ui.test.ts`: `MapPanel`·`MapScreen`을 `../ui/map.tsx`에서. `App`·`patronPair`는
그대로 `app.tsx`다. 다른 파일은 `ui/app.tsx`를 import하지 않아 손댈 곳이 없다
(`tools/e2e.ts`는 DOM만 본다).

## 하지 않는 것

- **`combat.tsx`(550줄)는 안 나눈다.** `EnemyButton`·`PlayerActor`·`FavorMeter`·
  `PromiseRow` 전부 전투 화면 전용이고 다른 화면이 가져다 쓰지 않는다 — 나누면 파일 수만
  늘고 결합은 그대로다. 다른 화면이 그중 하나를 쓰는 날 그것만 꺼낸다.
- **`style.css`는 안 나눈다.** 이 CSS는 전역 캐스케이드다 — `.god-legend`·`.hint`·`.primary`·
  토큰 배지를 여러 화면이 공유하고, 같은 특이도끼리는 선언 순서가 승자를 정한다
  (`.map-node.rest` 뒤의 `.map-node.open`). 화면별 파일로 쪼개면 import 순서가 곧
  캐스케이드 순서가 되어 「순수 이동」이 성립하지 않는다. Vite가 한 파일로 묶어 결과
  이득도 없다. 역할 분리는 이미 있다: `motion.css`(애니메이션)·`stats.css`(별도 진입점).
  CSS Modules 전환은 재설계라 이 플랜 밖이다.
- **디렉토리 계층 없음.** `ui/screens/` 같은 층은 파일 열 개짜리 폴더에 과하다.

## 완료 정의

- `app.tsx`에 화면 컴포넌트가 없다 — `App`이 import해서 고르기만 한다.
- 옮긴 함수의 본문 diff가 0이다 (`git diff --color-moved`로 이동만인지 확인).
- 규칙·값·데이터·봇을 안 건드리므로 밸런스 게이트는 재측정하지 않는다.

## 검증

```text
npx tsc --noEmit
npm test
npm run e2e            # aside CLI — 시작→지도→전투→결과 한 바퀴
```

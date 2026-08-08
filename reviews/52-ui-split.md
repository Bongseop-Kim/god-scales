# R-52 · ui 화면 분리와 폴더 구조

`reviews/52-ui-split.md` · [색인](00-index.md) · 관련 [R-43](43-shell.md) · [R-17](17-ui.md)

## 결론

**통과.** `app.tsx` 671줄에 살던 화면 넷(인트로·시작·지도·결과)을 화면별 파일로 갈랐고,
실행 중 사용자 지시로 `ui/`를 두 층으로 세웠다 — FSD를 느슨하게 참고했고 규칙 전부를
들여오지는 않았다(파일 스물에 layers·slices·segments는 과하다).

```text
ui/
  app.tsx            셸 — 라우팅·런 상태. 화면 컴포넌트가 없다
  screens/           화면 하나 = 파일 하나 (setup · map · combat · choices · reward · result · stats)
  shared/            화면 둘 이상이 쓰는 것 (backdrop · card · header · icon · tokens · fx · sfx · export · art-keys)
  style.css 등       ui 루트 유지 — `tools/size.ts`의 `ui/fonts` 경로와 `url()` 상대경로를 안 건드린다
```

## 구현

- `ui/screens/setup.tsx`: IntroScreen · SetupScreen · DeckEditor · SplitField · FullscreenButton · cardIndex.
  FullscreenButton은 셸과 인트로가 같이 쓰는데 app에 남기면 setup → app 순환이라 여기 산다
- `ui/screens/map.tsx`: MapScreen · MapPanel · takenLanes · 갈래/칸 라벨 · markerTransition
- `ui/screens/result.tsx`: ResultScreen · Summary. MapPanel·takenLanes는 map에서 온다
- `ui/shared/backdrop.tsx`: hero 아트 glob이 여기로 왔다 — 배경 그림의 집(`backdropArt`)과 같은 자리
- `ui/app.tsx` 210줄: App · patronPair · screens · screenTransition만 남았다
- 나머지 이동은 `git mv`뿐이고 diff는 상대 경로 한 단(`../` → `../../`, glob 키 포함)이다
- import 갱신: `stats-main.tsx` · `tools/art.ts` · `test/{ui,range,free,demands,stats}.test.ts`

「순수 이동」에서 벗어난 것 셋뿐이다: 파일 경계를 넘는 다섯(FullscreenButton · IntroScreen ·
SetupScreen · ResultScreen · takenLanes)에 `export`가 붙었고, hero에 한 줄 주석이 생겼고,
glob 경로가 한 단 깊어졌다. 함수 본문은 전부 그대로다.

## 하지 않은 것

- `combat.tsx`(550줄) 내부 분해 — 전부 전투 전용이라 나눠도 결합이 그대로다. 다른 화면이
  그중 하나를 쓰는 날 그것만 shared로 꺼낸다
- `style.css` 분리 — 전역 캐스케이드라 같은 특이도끼리 선언 순서가 승자를 정한다
  (`.map-node.rest` 뒤의 `.map-node.open`). 쪼개면 import 순서가 곧 캐스케이드 순서가 되어
  「동작 변화 0」이 성립하지 않는다. CSS Modules 전환은 재설계라 이 플랜 밖이다
- `fonts/`·CSS의 하위 폴더 이동 — `tools/size.ts`가 `ui/fonts`를 세고 `style.css`가
  `./fonts/`·`../art/`를 상대로 가리킨다. 옮기면 게이트와 url() 둘을 같이 고쳐야 한다

## 검증

```text
npx tsc --noEmit                 통과
npm test                        24파일 · 179테스트 통과
npm run e2e                     e2e ok — 아홉 화면 측정 · 40결정 · 덱 편집 왕복 · 반출 재생
```

첫 e2e 한 번은 reward 화면 `overflowX`로 떨어졌다가 재실행에서 아홉 화면 전부 통과했다 —
이동은 reward의 DOM도 CSS도 안 바꿔서 타이밍성 플레이크로 본다. 다시 나오면 그때가
`tools/e2e.ts`의 측정 시점을 볼 자리다. 규칙·값·데이터·봇은 안 건드려 밸런스는 재측정하지 않았다.

> **원인은 화면 흔들림이었다**(R-52·R-57·R-58에 세 번 적힌 뒤 [사후 수정](00-index.md)에서 닫혔다).
> `speak(3)`과 개입 컷인이 `document.body`에 `translateX`를 걸었고, **`body`의 transform은 그만큼이
> 뷰포트의 가로 스크롤 영역이 된다** — 흔드는 200~220ms 동안 `documentElement.scrollWidth >
> innerWidth`가 참이다. 브라우저 실측(1440px): 정지 `false` · `body` 흔들림 `true` · `.shell`
> 흔들림 `false`. 흔드는 대상을 `.shell`로 옮겼다(좌우 여백이 있어 ±10px이 판 밖으로 안 나간다).

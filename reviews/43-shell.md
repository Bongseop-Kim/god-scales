# R-43 · 창을 쓰는 법 — 그림이 안 뜯기고, 좁혀도 안 눌리고, 전체화면이 있다

[색인](00-index.md) · 계획 `plans/43-shell.md`(삭제됨) · [◀ R-42](42-mapwalk.md) · [R-17](17-ui.md) · [R-19](19-deploy.md) · [R-37](37-wire.md)

## 결론

**통과 · 완료 정의 일곱 중 다섯은 실측, 둘은 이 환경에서 못 잰다**(Firefox · 실제 전체화면 전환 — 아래 「못 본 것」). 규칙·값·데이터·엔진·화면 구성은 한 글자도 안 바뀌었다. 브라우저를 상대하는 코드가 `main.tsx` 5줄 + CSS 6줄 + 컴포넌트 하나로 생겼다.

| 완료 정의 | 판정 |
|---|---|
| 드래그 | ✓ Chromium 실측 — `dragstart`가 `defaultPrevented: true`, `<img>`의 계산값 `-webkit-user-drag: none`. **Firefox는 못 봤다** |
| 선택 | ✓ `body`의 계산값 `user-select: none`. **시드 입력만 뒤집었다** — 계획 함정 6의 가정과 반대다(아래) |
| 커서 | ✓ 파생 — 드래그 세션이 시작을 안 하므로 브라우저가 커서를 바꿀 구간이 없다. 별도로 재지 않았다 |
| 고정 크기 | ✓ 700 · 900 · 1200 · 1600에서 **열 구성 동일, 카드는 `140 × fit`**(아래 표) |
| 가로 스크롤 | ✓ 넷 다 `scrollWidth === innerWidth`, `overflowX: false` |
| 전체화면 | ✓ 버튼이 열 화면에 있고 `form.setup` 밖 `type="button"`(테스트), `fullscreenchange` 동기화 양방향 실측. **전환 자체는 이 브라우저가 안 내준다** |
| 게이트 | ✓ `overflowX` false ×8 · `halfEmpty` false ×8 · 12/12층 완주 · 반출 재생 일치(`diverged: -1`, 330결정) |

`npx tsc --noEmit` 통과 · `npm test` **137**통과(22파일) · `npm run build` 통과 · `npm run e2e` 통과(시드 371 · 330결정 · 12층 완주 · 최종 체력 10 · 전투 6 · 호의 30·74 · 자유 덱 24결정). **밸런스는 안 쟀다** — `npm run tune`을 안 돌렸다. 규칙·값·데이터·봇이 불변이라 잴 것이 없다([R-41](41-cardface.md)·[R-42](42-mapwalk.md)와 같은 자리).

---

## 실측 — 네 폭 (함정 4)

`aside`는 창을 못 줄인다 — CDP `Emulation`·`Browser` 도메인이 둘 다 막혀 있다(`'Emulation.setDeviceMetricsOverride' wasn't found`). **같은 출처 `<iframe>`이 뷰포트를 대신했다**: `innerWidth`·`resize`·미디어 쿼리·`100vh`가 전부 iframe 크기를 본다. 세 화면(시작·경로·전투)을 네 폭에서 다시 쟀다.

| 창 폭 | `--fit` | `.shell` | 카드 | 전투 두 열 | 가로 스크롤 |
|---|---|---|---|---|---|
| 700 | **0.653** | 679 (시작 470) | 91 | 264 · 396 | false |
| 900 | **0.840** | 873 (시작 604) | 118 | 340 · 510 | false |
| 1200 | 1.000 | 1040 (시작 720) | 140 | 405 · 607 | false |
| 1600 | 1.000 | 1040 (시작 720) | 140 | 405 · 607 | false |

**열 비율이 네 폭에서 같다**(264/396 = 340/510 = 405/607 = 0.667) — 720~1040px의 「대비 없는 구멍」이 닫혔다. 카드는 `140 × fit`으로 정확히 떨어지고(140·118·91), 경로 화면의 `.map-panel.walkable`도 `520 × fit`(520·437·340)이다. 좁으면 통째로 작아질 뿐이다.

시작 화면 세로 중앙은 **네 폭 다 위 0 · 아래 0**이다(함정 3). `.setup`의 `min-height: 100vh`를 `calc(100vh / var(--fit, 1))`로 나눴다 — `zoom` 안의 `100vh`는 그만큼 짧아지므로 나누지 않으면 축소된 창에서만 세로 중앙이 위로 뜬다. 계획이 「눈으로 본다」고 적은 자리인데 기하가 확정적이라 미리 닫고 실측으로 확인했다.

---

## 만든 것

### 1 · 드래그·선택 — CSS 셋 + 리스너 하나

```css
body { … user-select: none; -webkit-user-select: none; }
img { -webkit-user-drag: none; }
input { user-select: text; }        /* ← 계획에 없던 한 줄 */
```

```ts
addEventListener("dragstart", (event) => event.preventDefault());   /* main.tsx */
```

**계획 함정 6의 가정이 틀렸다.** 「폼 컨트롤은 브라우저가 예외로 둔다」를 확인했더니 Chrome은 안 뒀다 — `<input type=number>`의 계산값이 그대로 `user-select: none`이었다. E2E는 안 죽는다(`tab.fill`은 값을 직접 넣는다) 그래서 게이트로는 영영 안 잡히는 자리인데, **사람은 시드를 골라 지울 수 없다.** 한 줄로 뒤집었다.

우클릭은 계획대로 안 막았다. `contextmenu`를 막으면 중클릭 스크롤과 브라우저 기본 동작이 같이 죽고, 게임에 우클릭 동작이 없다.

### 2 · 고정 크기 — `zoom` 한 줄

```css
.shell { width: 1040px; margin: 0 auto; padding: 64px 0; zoom: var(--fit, 1); }
```

```ts
const fit = () => document.documentElement.style.setProperty("--fit", String(Math.min(1, innerWidth / 1072)));
```

상한 1은 픽셀아트 때문이다 — 140px 카드 그림과 16px 마커는 정수배가 아닌 확대가 곧 손상이다. `transform: scale`이 아닌 이유 셋은 계획 그대로고, 그중 「`fixed` 자손을 안 가둔다」가 실제로 값을 냈다: [R-42](42-mapwalk.md)가 `y` 전환 때문에 `.backdrop`에 `height: 100vh`를 못 박은 것과 같은 함정을 `zoom`은 아예 안 만든다.

**`@media (max-width: 720px)` 여섯 줄을 지웠다** — 계획에 없던 삭제다. 미디어 쿼리는 뷰포트를 보고 `zoom`은 그 안을 줄이므로, 둘이 같이 서면 700px 창에서만 2열이 1열로 접힌다. 완료 정의 「네 폭에서 열 구성이 같다」와 정면으로 부딪히는 여섯 줄이라 남길 수 없었다. 좁은 창 대비는 이제 `--fit` 하나가 든다.

### 3 · 전체화면 — `.shell` 바깥의 고정 버튼

`FullscreenButton`은 상태를 직접 들지 않는다. 정본은 `document.fullscreenElement`고 구독은 `document`의 `fullscreenchange`다 — F11·Esc·창 전환으로 나가도 글자가 안 어긋난다. 정본만 갈아끼워 양방향을 실측했다: `전체화면 → 창 모드 → 전체화면`.

**위가 아니라 아래에 붙였다**(계획은 `top: 12px; right: 12px`). 900px 창에서 눈으로 보니 버튼이 머리글 배지(「1턴」)를 정확히 덮었다 — `.shell`이 창의 97%를 쓰므로 여백이 13px뿐이고, 버튼은 `fixed`라 `zoom` 밖에서 원래 크기(64 × 25px)로 남기 때문이다. 오른쪽 **아래**는 열 화면 다 배경뿐이다(문서 높이가 뷰포트보다 낮다 — 900px 창에서 `scrollHeight === innerHeight === 900`). 흐리게(`opacity: .4`) 서고 가리키면 또렷해진다.

계획이 지목한 세 함정은 그대로 지켰다 — `.shell` 직계가 아니라 `AnimatePresence` 밖의 형제라 `tools/e2e.ts`의 `cols`가 안 흔들리고(게이트 통과가 그 증거다), `type="button"`이고, `className`이 E2E 선택자 어디에도 안 걸린다.

### 4 · 배선

| 자리 | 무엇 |
|---|---|
| `main.tsx` | `dragstart` 한 줄, `fit()` + `resize` (+15줄) |
| `ui/style.css` | `user-select` 둘, `-webkit-user-drag`, `.shell` 고정 + `zoom`, `.setup`의 `100vh` 나누기, `.fullscreen`, 미디어 쿼리 −6줄 |
| `ui/app.tsx` | `FullscreenButton` 하나 (+27줄) |
| `test/ui.test.ts` | 버튼이 `form.setup` 밖이고 `type="button"`이다 (+11줄) |
| `tools/e2e.ts` | **안 고쳤다** — 1440px에서 `--fit`이 1이라 이 변경이 E2E에 안 보인다 |

---

## 못 본 것

| 자리 | 왜 |
|---|---|
| **Firefox** | `aside`가 Chromium이고 CLAUDE.md가 브라우저 확인을 `aside`로 못 박는다. Firefox 경로는 코드로만 있다 — `dragstart` 한 줄(CSS `-webkit-user-drag`는 Firefox에 없다)과 `zoom` **126+**(2024-05). **지원 하한을 Firefox 126 · Chrome 126 · Safari 17.4로 정한다**(`zoom`이 셋 다에서 가장 늦게 온 기능이다). 그 아래에서는 `zoom`이 무시되고 1040px 고정만 남아 좁은 창에 가로 스크롤이 생긴다 |
| **실제 전체화면 전환** | 클릭은 핸들러에 닿고(`clicks: 1`) `document.fullscreenEnabled`도 true인데 `requestFullscreen()`이 **`TypeError: not granted`**로 거부된다 — Aside의 내장 브라우저가 사용자 제스처를 전체화면에 안 넘긴다. 버튼의 나머지 전부(클릭 도달 · 정본 동기화 양방향)는 실측했고, 남은 것은 브라우저가 허락하는 한 줄이다 |
| **커서 넷** | 드래그 중 커서를 잴 방법이 없다. 드래그 세션 자체가 안 열리므로(`defaultPrevented: true`) 커서가 바뀔 구간이 없다는 파생으로 둔다 |

---

## 계획과 어긋난 것

| 계획 | 실제 | 왜 |
|---|---|---|
| 버튼 `top: 12px` | **`bottom: 8px`** · 4px 9px · `.68rem` · `opacity .4` | 좁은 창에서 여백이 13px뿐이라 위 오른쪽이면 머리글 배지를 덮는다(스크린샷으로 봤다) |
| 함정 6 「브라우저가 예외로 둔다」 | **`input { user-select: text }`를 넣었다** | Chrome은 `<input>`을 예외로 안 둔다. 게이트로는 안 잡히고 사람만 다치는 자리 |
| 함정 3 「눈으로 본다」 | **`calc(100vh / var(--fit, 1))`로 미리 닫았다** | 기하가 확정적이다. 눈으로도 봤고 네 폭 다 위 0 · 아래 0 |
| (없음) | **`@media (max-width: 720px)` 삭제** | 남기면 700px에서만 1열이 되어 완료 정의를 깬다 |
| `aside`로 창 폭 넷 | **같은 출처 iframe** | `Emulation`·`Browser` 도메인이 막혀 있다. `innerWidth`·`resize`·`100vh`·미디어 쿼리는 iframe이 그대로 준다 |

---

## 남은 것

1. **부채꼴 바깥 카드가 좁은 창에서 5px 잘린다.** `.fan`의 회전축이 카드 아래 150%라 맨 왼쪽 카드가 열 바깥으로 22px(fit=1) 나가는데, 여백이 1040px 고정일 때 16px, 지금 900px 창에서 13px이다 — **이 계획 전에도 잘렸고**(22 > 16) 폭이 준 만큼 같이 줄어 크기는 그대로다. `overflowX`는 false다(왼쪽 넘침은 `scrollWidth`를 안 늘린다). 고치려면 `.decision-panel`의 왼쪽 패딩이나 `--a`의 상한이지 이 계획이 아니다
2. **`zoom`은 좌표를 쓰는 코드와 나눠 살 수 없다.** 지금은 `motion`의 `layoutId`만 좌표를 만지고 `zoom` 안에서 일관되게 돈다(경로 이동 열 번이 게이트를 지났다). 나중에 `getBoundingClientRect()`로 뭔가를 놓는 코드가 생기면 그 값은 이미 `fit`이 곱해진 값이다 — 나누는 자리를 한 곳으로 모아야 한다
3. **버튼이 `.shell` 밖이라 좁은 창에서 상대적으로 커진다.** 900px에서 본문은 0.84인데 버튼은 1.0이다. 조작 부품이라 지금은 그게 옳지만, 조작 부품이 둘 이상 되면 「`zoom` 밖 UI」의 크기 규칙이 필요해진다

계획이 「다음 자리」로 적어 둔 여섯은 그대로 남는다 — **포커스 상실 시 키 상태 비우기**(키보드 입력이 아직 없다 · 오는 날 `event.code`), **오디오 프리로드 + 제스처 unlock**(`audio/`에 클립이 하나도 없다 — 트리거는 「클립이 들어오는 날」), **캐시 무효화**(GitHub Pages는 캐시 헤더를 못 정한다 — 호스팅을 옮기는 날), **런 저장·이어하기**(스키마 버전 필드를 처음부터), **주사율**(턴제라 프레임에 묶인 값이 없다 — 실시간 틱이 생기는 날 delta 또는 고정 timestep), **긴 세션 메모리**(12층 런이 3~4분이라 아직 잴 크기가 아니다).

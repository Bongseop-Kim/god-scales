# P-43 · 창을 쓰는 법 — 그림이 안 뜯기고, 좁혀도 안 눌리고, 전체화면이 있다

`plans/43-shell.md` · [◀ P-42](42-mapwalk.md) · [색인](../reviews/00-index.md) · [R-17](../reviews/17-ui.md) · [R-19](../reviews/19-deploy.md) · [R-37](../reviews/37-wire.md)

**크기** 작음 · **착수 조건** [P-41](41-cardface.md) → [P-42](42-mapwalk.md) 다음. `ui/app.tsx`를 셋이 다 열고 `ui/style.css`를 P-42와 같이 연다 — 다만 이 계획이 여는 자리는 **문서 루트와 `.shell` 선언 한 줄**이라 P-42의 `.map-panel`·`MapScreen`과 겹치지 않는다. 순서만 지키면 충돌은 없다

이 계획은 게임을 안 건드린다. **게임이 앉아 있는 창(browser window)을 다룬다.** 규칙·값·데이터·엔진·화면 구성은 한 글자도 안 바뀐다.

---

## 조사 — 문서 루트가 비어 있다

`main.tsx`는 12줄이고 `createRoot().render()`만 한다. `index.html`의 `<body>`에는 `<main id="app">` 하나다. **브라우저를 상대하는 코드가 프로젝트에 없다.** 그 결과가 셋이다.

### 1 · 스프라이트가 뜯긴다

`<img>`가 다섯 자리다. 전부 `alt=""`인 장식이다.

| 자리 | 무엇 |
|---|---|
| `ui/card.tsx:146` | 카드 그림 |
| `ui/backdrop.tsx:31` | 배경 한 장 |
| `ui/backdrop.tsx:33` | 프롭 둘 |
| `ui/combat.tsx:277` | 적 스프라이트 |
| `ui/combat.tsx:311` | 주인공 스프라이트 |

카드를 누르려고 살짝 끌면 브라우저가 **그림을 뜯어 반투명 고스트로 들고 간다.** 적을 조준하려다 이름 글자가 파랗게 잡힌다. 둘 다 게임에 없는 동작이고, 사용자는 자기가 뭘 잘못 눌렀는지 모른다.

**커서와 정면으로 부딪힌다.** `ui/style.css:38-45`가 상태마다 다른 PNG 커서 넷을 깐다 — 화살표·손·조준·금지. 드래그가 시작되는 순간 그 넷이 전부 브라우저 기본 드래그 커서로 바뀐다. 커서로 상태를 말하는 화면에서 **커서가 거짓말을 하는 유일한 구간**이다.

`grep -rn "user-select|draggable|dragstart" ui core main.tsx` → **결과 없음.** 막는 코드가 없다.

### 2 · 1040px 미만에서 화면이 눌린다

```css
.shell { width: min(1040px, calc(100% - 32px)); }   /* ui/style.css:57 */
```

폭이 유동이다. 그런데 **`--card-w: 140px`는 고정이다** — `ui/style.css:20`의 주석이 그 이유를 이미 적어 뒀다(부채꼴 겹침을 역산하려면 폭을 알아야 한다). 즉 안의 부품은 고정인데 담는 그릇만 줄어든다. 줄어드는 만큼 열 사이가 먼저 죽고, 그 다음 카드가 줄바꿈한다.

`@media (max-width: 720px)`(`ui/style.css:300`)가 패딩만 34px로 줄인다 — 720~1040px 구간은 **아무 대비가 없는 320px짜리 구멍**이다. 1366px 노트북에서 브라우저를 반만 쓰면 정확히 그 구간이다. E2E는 1440px에서만 재므로(`tools/e2e.ts:273`) 이 구간을 한 번도 안 본다.

### 3 · 전체화면이 없다

`grep -rn "fullscreen"` → **결과 없음.** 1040px 게임을 24인치 모니터에서 브라우저 탭·주소창·북마크바 아래로 본다. `.backdrop`(`ui/style.css:46`)이 화면 전체를 덮는 그림을 이미 깔고 있는데 그 그림의 위 100px을 브라우저 크롬이 먹는다.

---

## 완료 정의

**끌어도 안 뜯기고, 창을 좁혀도 레이아웃이 안 바뀌고, 전체화면 버튼이 여덟 화면 어디에나 있다.**

```bash
npx tsc --noEmit && npm test
npm run build
npm run e2e                          # 여덟 화면 레이아웃 + 12층 완주 + 반출 재생 일치
```

| 항목 | 판정 기준 |
|---|---|
| 드래그 | 카드·적·배경 어느 그림을 끌어도 고스트가 안 뜬다. **Firefox 포함** |
| 선택 | 어느 글자도 드래그로 안 잡힌다 |
| 커서 | 끄는 동안에도 커서 넷이 유지된다 |
| 고정 크기 | 창 폭 700·900·1200·1600에서 **열 구성과 카드 크기가 같다.** 좁으면 통째로 작아질 뿐이다 |
| 가로 스크롤 | 위 넷 전부에서 안 생긴다 |
| 전체화면 | 버튼이 여덟 화면 + 시작 + 결과에 있다. F11·Esc로 나가도 버튼 글자가 맞는다 |
| 게이트 | `overflowX` false · `halfEmpty` false · 12층 완주 · 반출 재생 일치 |

**밸런스는 안 잰다.** `npm run tune`을 안 돌린다 — 규칙·값·데이터를 안 건드리므로 잴 것이 없다.

---

## 설계

### 1 · 드래그·선택 — CSS 둘 + 리스너 하나

```css
/* ui/style.css — `*` 선언 옆 */
body { user-select: none; -webkit-user-select: none; }
img { -webkit-user-drag: none; }
```

```ts
/* main.tsx — createRoot 앞 */
/**
 * `-webkit-user-drag`는 Chromium·WebKit만 먹는다 — **Firefox는 이 속성이 없다.**
 * `<img>` 다섯 자리에 `draggable={false}`를 다는 것보다 문서에 한 줄이 짧고,
 * 나중에 붙는 여섯 번째 그림도 자동으로 든다
 */
addEventListener("dragstart", (event) => event.preventDefault());
```

**우클릭(`contextmenu`)은 안 막는다.** 게임에 우클릭 동작이 없어서 막을 이유가 없고, 막으면 중클릭 스크롤과 브라우저 기본 동작을 같이 죽인다. 우클릭에 기능이 붙는 날 **그 요소에서만** 막는 게 맞다.

`user-select: none`을 `body`에 거는 대가는 **결과 화면에서 요약 숫자를 복사할 수 없다**는 것이다. 반출 버튼이 JSON 전체를 파일로 주므로(`tools/e2e.ts:257`의 `filename` 검사가 그 자리다) 잃는 게 없다.

### 2 · 고정 크기 — `zoom` 한 줄

```css
.shell { width: 1040px; margin: 0 auto; padding: 64px 0; zoom: var(--fit, 1); }
```

```ts
/* main.tsx */
/**
 * 좁으면 **줄이기만** 한다. 1을 넘겨 키우면 140px 카드 그림과 16px 마커가 뭉갠다 —
 * 픽셀아트는 정수배가 아니면 확대가 곧 손상이다. 1072 = 1040 + 좌우 16px 숨통
 */
const fit = () => document.documentElement.style.setProperty("--fit", String(Math.min(1, innerWidth / 1072)));
fit();
addEventListener("resize", fit);
```

**`transform: scale`이 아니라 `zoom`인 이유가 셋이다.**

| | `transform: scale` | `zoom` |
|---|---|---|
| 레이아웃 박스 | 안 줄어든다 — 시각만 줄고 `scrollWidth` 계산이 브라우저마다 미묘하다 | 실제로 줄어든다 |
| `position: fixed` 자손 | **가둔다** — 조상에 transform이 있으면 viewport 기준이 깨진다 | 안 가둔다 |
| `transform-origin` | 중앙 정렬과 겹쳐 계산을 한 번 더 한다 | 없다 |

`.backdrop`은 `.shell`의 **형제**라(`ui/app.tsx:208`·`267`·`368`) transform이어도 지금은 안 갇힌다. 하지만 `ui/style.css:43`의 주석이 이미 「`.shell` 바깥에 서고 `fixed`다」를 규칙으로 적어 뒀다 — `zoom`을 고르면 그 규칙에 기대지 않아도 된다. 나중에 `.shell` 안에 `fixed`를 하나 넣는 사람이 이 계획을 안 읽어도 안 깨진다.

대가는 **Firefox 126+(2024-05)** 다. PC 웹 전용이므로 받는다.

### 3 · 전체화면 — `.shell` 바깥의 고정 버튼

```tsx
/* ui/app.tsx — App 최상단, .shell 바깥 */
function FullscreenButton() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    /**
     * 상태를 직접 들지 않는다 — F11·Esc·창 전환으로 나가면 내 state와 화면이 어긋난다.
     * 정본은 언제나 `document.fullscreenElement`다
     */
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return (
    <button type="button" className="fullscreen" onClick={() => (on ? document.exitFullscreen() : document.body.requestFullscreen())}>
      {on ? "창 모드" : "전체화면"}
    </button>
  );
}
```

```css
.fullscreen { position: fixed; top: 12px; right: 12px; z-index: 2; /* 나머지는 기존 버튼 토큰 */ }
```

- **`.shell` 안에 두면 안 된다.** `tools/e2e.ts:114`의 `measure`가 `layout.children`을 열로 세고 `HEADER`만 거른다 — `.shell` 직계에 버튼이 서면 그것이 열 하나로 잡혀 `cols` 비교가 어긋난다. `.backdrop`이 바깥에 선 것과 같은 이유다
- **`position: fixed`라 `zoom` 밖이다.** 좁은 창에서 버튼만 원래 크기로 남는다 — 조작 부품이므로 그게 옳다
- **`type="button"` 필수.** 시작 화면은 `<form className="shell setup">`(`ui/app.tsx:209`)이고 `<button>`의 기본값은 `submit`이다. 폼 **바깥**에 서므로 실제로는 안전하지만, 나중에 안으로 옮기는 사람이 게임을 시작시켜 버린다
- `className`이 `.primary`도 `.choice`도 아니다 — E2E의 선택자 어디에도 안 걸린다(`form.setup button.primary`, `enabled("button.choice")`, `button.game-card`, `button.enemy`)
- **Esc를 게임 단축키로 쓰지 않는다.** 전체화면에서 Esc는 브라우저가 먹는다. Keyboard Lock API로 뺏을 수 있지만 게임에 Esc 동작이 없다

`requestFullscreen()`은 **클릭 핸들러 안에서만** 통한다 — 사용자 제스처 밖에서 부르면 거부된 Promise만 남고 화면은 그대로다. 시작 화면에서 자동으로 켜는 것은 불가능하고, 시도해서도 안 된다.

### 4 · 배선

| 자리 | 무엇 |
|---|---|
| `main.tsx` | `dragstart` 한 줄, `fit()` + `resize` |
| `ui/style.css` | `body`의 `user-select`, `img`의 `-webkit-user-drag`, `.shell` 폭 고정 + `zoom`, `.fullscreen` |
| `ui/app.tsx` | `FullscreenButton` 하나, `App` 최상단에 `.shell` 형제로 |
| `test/ui.test.ts` | 전체화면 버튼이 폼 밖이고 `type="button"`이다 |

**`tools/e2e.ts`는 안 고친다.** 1440px에서 `--fit`이 1이라 이 변경이 E2E에는 안 보인다 — 회귀만 확인한다.

---

## 함정

1. **`-webkit-user-drag`만 넣고 끝내면 Firefox에서 그대로 뜯긴다.** CSS와 `dragstart` 둘 다 필요하다. 확인은 반드시 Firefox에서
2. **`zoom`은 Firefox 126+**(2024-05). 그 이하에서는 무시되고 1040px 고정만 남아 **좁은 창에서 가로 스크롤이 생긴다** — 조사 §2의 눌림보다 나쁘다. 지원 하한을 지금 정하고 리뷰에 적는다
3. **`.setup { min-height: 100vh }`**(`ui/style.css:58`)가 `zoom` 안이다. 축소되면 렌더 높이가 `100vh × fit`이 되어 시작 화면의 세로 중앙 정렬이 위로 뜬다. `.setup`은 `.shell`의 클래스 짝이라 같이 줄어든다 — **좁은 창에서 시작 화면을 눈으로 본다**
4. **E2E는 1440px만 잰다**(`tools/e2e.ts:273`). §2 전체가 게이트 바깥이다. `aside` CLI로 창 폭 700·900·1200에서 한 번씩 눈으로 보고 결과를 리뷰에 적는다 — 게이트를 늘리는 대신 사람이 한 번 본다
5. **`.shell` 직계에 버튼을 넣으면 `cols`가 어긋난다**(§3). `HEADER`만 걸러진다
6. **`user-select: none`은 `<input type=number>`(시드 입력)까지 덮는가.** 폼 컨트롤은 브라우저가 예외로 두지만 확인한다 — E2E가 `tab.fill("input[type=number]", ...)`로 시드를 넣는다(`tools/e2e.ts:44`). 여기가 막히면 E2E가 첫 줄에서 죽는다
7. **`fullscreenchange`는 `document`에 건다.** `element`에 걸면 나가는 순간을 놓친다
8. **`requestFullscreen()`의 거부는 조용하다.** 클릭 핸들러 밖에서 부르면 아무 일도 안 일어난다 — `.catch()`로 삼키지 말고 그냥 클릭 안에서만 부른다
9. **커서 PNG는 그대로 둔다.** 드래그를 막으면 커서가 안 바뀌므로 `ui/style.css:38-45`는 손댈 이유가 없다. 「커서도 정리하자」로 번지면 이 계획이 아니다

---

## 다음 자리

이번에 **안 하는 것들**이다. 근거를 같이 적어 둔다.

1. **포커스를 잃으면 키 상태를 비운다.** alt-tab 중 키가 눌린 채로 굳는 것이 PC 웹 게임 버그 1위인데, **지금 키보드 입력이 없다.** 단축키가 생기는 날 `addEventListener("blur", () => pressed.clear())` 한 줄. 같이 오는 것: 게임 조작은 `event.key`가 아니라 **`event.code`** — AZERTY에서 WASD는 물리적으로 ZQSD 자리다
2. **오디오 프리로드 + 제스처 unlock.** `ui/sfx.ts:6`이 호출마다 `new Audio()`를 만들고, Chrome은 사용자 상호작용 전 AudioContext를 `suspended`로 만든다. **`audio/`에 클립이 하나도 없어서**(4.0K) 지금 고쳐도 잴 것이 없다 — 그 파일 주석이 적은 upgrade path의 트리거는 「겹치는 sfx」가 아니라 **「클립이 들어오는 날」** 이다
3. **캐시 무효화.** Vite가 JS·CSS에 해시를 붙이지만 `index.html`과 `public/`·`art/` 자산은 해시가 없다. `index.html`은 `no-cache`, 해시 붙은 것은 `immutable`이 정석인데 **GitHub Pages는 캐시 헤더를 못 정한다**([DEPLOY.md](../DEPLOY.md)) — 호스팅을 옮기는 날의 자리다
4. **런 저장·이어하기.** localStorage는 ~5MB에 사용자가 DevTools로 자유롭게 고칠 수 있고, 브라우저 정리·용량 압박으로 **조용히 사라진다.** 싱글플레이라 치트는 무시해도 되지만 소실은 대비해야 한다 — 넣는 날 스키마 버전 필드를 **처음부터** 박는다
5. **주사율.** 144/240Hz에서 게임이 2배로 도는 것이 웹 게임 고전 버그다. 지금은 턴제라 프레임에 묶인 값이 없다 — 실시간 타이머·자동전투 틱을 넣는 날 초당 단위(delta) 또는 고정 timestep + accumulator, 그리고 백그라운드 복귀 delta 클램프
6. **긴 세션 메모리.** 힙이 톱니면 정상, 우상향이면 누수다. 12층 런이 3~4분이라 아직 잴 크기가 아니다 — 무한 모드가 생기면 Chrome 힙 스냅샷 비교

---

## 세션 종료

- [ ] `ui/style.css` — `body`에 `user-select: none`(+ `-webkit-`), `img`에 `-webkit-user-drag: none`
- [ ] `main.tsx` — `dragstart` preventDefault
- [ ] `ui/style.css` — `.shell` 폭 1040px 고정 + `zoom: var(--fit, 1)`
- [ ] `main.tsx` — `fit()` + `resize`, 상한 1 고정
- [ ] `ui/app.tsx` — `FullscreenButton`(`type="button"`, `.shell` 형제, `fullscreenchange` 구독 + 정리)
- [ ] `ui/style.css` — `.fullscreen` 고정 위치
- [ ] `test/ui.test.ts` — 전체화면 버튼이 `form.setup` 밖이다 · `type="button"`이다
- [ ] Firefox에서 카드·적·배경을 끌어 본다 — 고스트 없음, 커서 유지
- [ ] `aside`로 창 폭 700 · 900 · 1200 · 1600 — 열 구성 동일, 가로 스크롤 없음, **시작 화면 세로 중앙**(함정 3)
- [ ] 시드 입력이 여전히 채워진다(함정 6)
- [ ] `npx tsc --noEmit` · `npm test` · `npm run build` · `npm run e2e`(`overflowX`·`halfEmpty` false · 12층 완주 · 반출 재생 일치)
- [ ] `reviews/43-shell.md` 작성 후 이 파일 삭제 — **`zoom` 지원 하한**(함정 2)과 **네 폭의 실측**(함정 4)을 남긴다

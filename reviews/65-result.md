# R-65 · 결과 화면 정리 · 다시 시작과 이탈 확인

[P-65] 수행 결과. **규칙·값·데이터·봇은 한 글자도 안 바뀌었다** — 화면과 배선만 만졌으므로 밸런스는
안 쟀다. `tools/e2e.ts`는 계획이 예고한 **두 줄**만 고쳤고 그대로 완주한다.

## 한 일

### 1. 결과 화면을 한 줄기로 (`ui/screens/result.tsx` · `ui/style.css`)

2열(`.result-columns`, `.8fr 1.2fr`)이 죽고 위에서 아래로 쌓인다:
`header` → `summary-grid` → `map-columns` → `used-cards` → `actions`.

- **로그 열 줄 삭제.** `.combat-log`와 그 CSS가 같이 죽었다 — `result.log`는 그대로 생성되고
  리포트·CLI가 계속 읽는다. `.map-panel, .decision-panel, .combat-log, .summary-grid article`
  공용 규칙에서 `.combat-log`를 뺐고, 「스크롤은 `.overlay-body`와 `.combat-log ol`만」이라고 적힌
  파일 머리 주석도 하나로 줄었다(이제 `.overlay-body` 하나다).
- **`.outcome` 배지 삭제** — `h1`의 「승리/패배」와 같은 말이었다.
- 지도 둘이 반쪽(≈455px)에서 **1040px 전폭**으로 나왔다. 마지막 카드 셋은 로그가 있던 오른쪽 칸에서
  지도 아래로 내려와 가운데 선다.
- eyebrow 문구·요약 넷의 라벨·`h1` 텍스트는 **한 글자도 안 건드렸다** — 셋 다 e2e의 계약이다.

### 2. 반출 버튼을 구석으로 (`ui/style.css` · `tools/e2e.ts`)

`.primary`가 「다시 시작」에게 갔고 반출은 새 `.ghost`(작은 글씨 · `opacity: .4` · hover에 1)로
같은 줄 오른쪽 끝이다(`.actions .ghost { margin-left: auto }`). `.fullscreen`·`.global-icons`와
같은 40% 물러남이고, 같은 이유다.

`tools/e2e.ts`는 셀렉터 두 줄뿐이다 — `:164` 반출이 `button.ghost`로, `:230` 다시 시작이
`button.primary`로. **반출 → CLI 재생 동치 증명은 그대로 살아 있다.**

### 3. 「다시 시작」을 상태 바 왼쪽 끝에 (`ui/shared/header.tsx` · `ui/app.tsx`)

`StatusBar`에 `onRestart` 하나가 늘고 `.vitals`의 첫 자식으로 버튼이 선다. 격자
(`1fr auto 1fr`)는 안 건드렸다 — flex 줄 안에 하나가 는 것뿐이다. 크기 규칙은 `.whereabouts button`의
것을 셀렉터만 넓혀 공유한다(`:is(.vitals, .whereabouts) button`). `.vitals`에 `align-items: center`와
`white-space: nowrap`을 더했다 — 버튼이 서면서 줄 정렬 기준이 baseline에서 바뀌어야 했다.

런 중에만 보이는 것은 `StatusBar` 자체의 조건(`pending && !opening`)이 이미 준다.

### 4. 확인 창 (`ui/app.tsx`)

`OverlayKind`에 `"restart"` 하나. 새 컴포넌트를 안 만들었다 — `Overlay` 셸 안에 `<p>` 하나와
`.actions` 한 줄(「다시 시작」 primary · 「취소」)이 전부다. `confirm()`은 안 썼다.
Esc·바깥 클릭·×는 셸이 이미 취소로 든다.

### 5. 새로고침도 한 번 묻는다 (`ui/app.tsx`)

`pending`이 있을 때만 `beforeunload`에 `preventDefault` 하나. `running = Boolean(pending)`을
의존성으로 두어 결정마다(런당 ~36번) 다시 걸지 않는다.

## 실측 (aside · 1440×900)

| 잰 것 | 값 |
|---|---|
| 상태 바 「다시 시작」 | 왼쪽 끝 · `.status-bar > div` 넘침 false · 문서 가로 넘침 false |
| 확인 창 | 제목 「다시 시작」 · 본문 「진행 중인 런을 버립니다. 처음부터 시작할까요?」 · `primary:다시 시작` `취소` |
| 취소 | dialog 닫힘 · `data-phase`가 `path` 그대로 |
| 승인 | `[data-phase='setup']` 도달 · 상태 바 사라짐 |
| `beforeunload` | 시작 화면 false · **런 중 true** · 되돌아온 시작 화면 false · 결과 화면 false |
| 결과 화면 | `.outcome` 없음 · `.combat-log` 없음 · 자식 `summary-grid · map-columns · used-cards · actions` |
| 결과 버튼 | `primary:다시 시작` · `ghost:런 JSON 반출`(계산된 opacity `0.4`) |
| 결과 높이 | `.result-layout` 949px · 뷰포트 900 · 가로 넘침 false |

**결과 화면이 900px 눈금을 49px 넘는다 — 그 49px은 `.shell`의 아래 패딩이다.** 마지막 줄(`.actions`)의
바닥이 893px이라 잘리는 내용은 없고, `--fit`이 `innerHeight / 900`도 보므로 더 짧은 창에서는 통째로
같은 비율로 줄어든다.

`beforeunload` 확인은 **합성 이벤트의 `defaultPrevented`까지**다 — 진짜 브라우저 확인 창은 CDP에서
못 본다. 문구도 브라우저 것이라 우리가 바꿀 자리가 아니다.

## 검증

| | |
|---|---|
| `npx tsc --noEmit` | 통과 |
| `npm test` | 24파일 185테스트 통과 |
| `npm run e2e` | **통과** — 완주(승리 · 12/12층) · 반출 blob · 재생 동치 · 「다시 시작」 → setup · 자유 덱 2회차 전부 살아 있다 |
| `npm run sim` | **안 돌렸다** — 규칙·값·데이터·봇 불변이라 잴 것이 없다 |
| aside 실측 | 위 |

e2e에서 한 번 걸린 것: `tools/e2e.ts`의 `browserScript`는 템플릿 문자열이라 **주석에도 백틱을 못 쓴다.**
`.ghost`를 백틱으로 감싼 주석 한 줄이 문자열을 끊어 `tsc`가 잡았다(파일이 이미 그 함정을 적어 둔 자리다).

## 안 한 것

- **반출 기능 삭제 없음** — 버튼을 강등만 했다. 지우면 e2e가 증명하던 동치가 사라진다.
- eyebrow 문구·요약 라벨·`h1` 텍스트 변경 없음.
- `result.log` 생성 삭제 없음 — 화면에서만 내렸다.
- 자동 저장·이어하기 없음. 「다시 시작」은 버리는 길이다.
- 「다시 시작」을 시작 화면·타이틀에 두지 않았다.
- `reviews/00-index.md` 갱신 없음 — P-59부터 이 파일에 줄이 없다(그 관례를 그대로 따랐다).

## 남은 자리

- **결과 화면 아래 여백 49px이 900 눈금 밖이다**(위 실측). 내용은 안 잘리므로 `.shell`의 패딩을
  화면별로 가르는 일은 안 했다 — 가르는 순간 열 화면이 각자 다른 여백을 갖는다.
- **승리 쪽 결과 화면은 e2e로만 봤다**(h1 「승리」 · eyebrow `12/12층`). aside 스크린샷은 1층에서
  끝나는 자유 덱이라 패배 화면이다 — 레이아웃은 같고 배경·프롭 셋만 다르다.
- **상태 바가 좁아질 여지.** `.vitals`가 `1fr` 칸이고 이제 버튼이 하나 더 산다. 1440px에서 넘침은
  없지만, 호의 미터에 「은총 N」이 둘 다 붙는 판에서는 여유가 그만큼 줄어든다.

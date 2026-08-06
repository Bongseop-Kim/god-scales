# P-38 · 후원 선택 — 열 조합이 다 있는데 화면이 하나만 준다

`plans/38-patron.md` · [◀ P-36](36-shove.md) · [색인](../reviews/00-index.md) · [R-37](../reviews/37-wire.md)

**크기** 작음 · **착수 조건** 없음. [P-35](35-range.md)·[P-36](36-shove.md)과 겹치는 파일은 `ui/app.tsx` 하나뿐이고 그쪽은 전투 화면만 건드린다

엔진은 열 조합을 다 굴린다 — 시작 덱(`sim/engine.ts:335`), 보상 풀(`:67`), 호의·은혜 키(`:344`), 융합 카드 10장(`data/cards.json`의 `patron_pair`), `tune`의 조합 행렬(`sim/heatmap.ts:39`)이 전부 조합을 인자로 읽는다.

**막힌 곳은 한 줄이다.** `ui/app.tsx:80`이 `runSteps(nextSeed)`를 부르고, 기본값 `["zeus", "athena"]`(`sim/engine.ts:331`)가 그대로 런이 된다. 타이틀 화면(`ui/app.tsx:174`)에는 시드 입력과 다섯 신 **범례**만 있다 — 색과 이름을 보여 주고 고르게는 하지 않는다.

이 계획은 규칙을 하나도 안 바꾼다. **화면에 없는 결정 하나를 화면에 낸다.**

---

## 완료 정의

**타이틀에서 신 둘을 고르고, 고른 조합으로 12층을 돌고, 반출한 JSON이 그 조합으로 재생된다.**

```bash
npx tsc --noEmit && npm test
npm run tune                             # 조합 승률 하한 0.05 — 규칙 불변이므로 값이 안 움직여야 한다
npm run e2e
```

| 항목 | 판정 기준 |
|---|---|
| 선택 | 다섯 중 정확히 둘. 둘이 아니면 「런 시작」이 안 눌린다 |
| 열 조합 | 열 조합이 다 시작된다 — `no fused card` 예외가 어느 조합에서도 안 난다 |
| 순서 무관 | 아테나→제우스와 제우스→아테나가 **같은 런**이다(같은 시드 → 같은 결정열) |
| 반출·재생 | 반출 JSON에 조합이 들어가고, 그 파일을 CLI가 같은 조합으로 재생한다 |
| 옛 로그 | `patrons` 없는 replay는 제우스+아테나로 재생된다 — `logs/`의 파일이 안 깨진다 |
| 게이트 | `tune` 하한 하나. 새 지표·조합별 화면 표시를 만들지 않는다 (CLAUDE.md) |

---

## 설계

### 1 · 선택은 토글 다섯이다 — 드롭다운 둘이 아니다

드롭다운 둘은 「같은 신 두 번」을 만들 수 있고, 그러면 `runSteps`가 융합 카드를 못 찾아 던진다(`sim/engine.ts:333`). 배제 로직을 두 셀렉트 사이에 걸 바에는 **선택 집합 하나**가 짧다.

```tsx
const [picked, setPicked] = useState<GodId[]>(["zeus", "athena"]);
const toggle = (god: GodId) =>
  setPicked((now) => now.includes(god) ? now.filter((id) => id !== god) : [...now, god].slice(-2));
```

- 셋째를 누르면 **가장 오래된 것이 빠진다**(`slice(-2)`) — 「먼저 해제하세요」를 안 만든다
- 기본값은 지금과 같은 제우스+아테나다. 아무것도 안 고르고 시작하던 사람이 같은 런을 얻는다
- 이미 서 있는 `.god-legend`(`ui/app.tsx:186`)를 **버튼으로 바꾼다.** 색·이름은 그대로 `godIds`·`godName`에서 읽는다(`ui/header.tsx:11`) — 새 표를 만들지 않는다
- 선택 상태는 `aria-pressed`다. `.sound-toggle`이 이미 같은 꼴을 쓴다(`ui/app.tsx:213`)
- 둘이 아니면 submit 버튼 `disabled`. 시드 검증이 `setCustomValidity`로 도는 자리(`ui/app.tsx:74`)와 섞지 않는다 — 그쪽은 자유 입력이고 이쪽은 구조적으로 둘 아니면 못 만든다

### 2 · 순서를 정규화한다 — 조합은 집합이지 순서열이 아니다

**`patrons[0]`과 `[1]`은 대칭이 아니다.** 시작 덱이 `[0]`에게 2·2·1, `[1]`에게 3·1·1을 준다(`sim/engine.ts:335`). `grace_*` 시나리오의 호의 70도 `[0]`이 받는다(`:344`).

고른 순서를 그대로 넘기면 **같은 조합이 두 게임**이 되고, 그 둘 중 하나는 `tune`이 잰 적 없는 열이다. 화면에서 넘길 때 `gods` 순서(`sim/engine.ts:23`)로 정렬한다:

```ts
const patrons = godIds.filter((id) => picked.includes(id)) as unknown as PatronPair;
```

`data/gods.json`의 순서와 `sim/engine.ts:23`의 `gods` 배열 순서가 같다(제우스·포세이돈·아테나·아레스·아르테미스) — `godIds`로 거르면 heatmap의 `"zeus+athena"` 표기와도 저절로 맞는다. **두 배열이 갈리면 조용히 다른 런이 된다**: `ui/header.tsx`의 `godIds`가 `data/gods.json`을 읽고 엔진의 `gods`는 코드 상수이므로, 이 정렬이 그 둘을 붙이는 유일한 자리다.

**테스트는 `data/gods.json`과 `sim/engine.ts`의 `gods`를 직접 비교한다.** `godIds`를 읽으면 테스트가 `ui/header.tsx`를 — 즉 브라우저 모듈을 — 끌어온다.

### 3 · 반출 파일이 조합을 들어야 한다

지금 `ReplayFile`은 `{ seed, actions, replay_mode }`다(`sim/replay.ts:16`). 조합이 없으면 제우스+아테나 아닌 런의 반출은 **조용히 다른 게임으로 재생된다** — 덱이 다르므로 카드 id가 손에 없고, 결정열이 어긋난 채로 끝까지 간다.

```ts
export type ReplayFile = { seed: number; actions: ReplayAction[]; replay_mode: "action_log"; patrons?: PatronPair };
```

- **선택 필드다.** `patrons`가 없으면 `["zeus", "athena"]` — 지금 `logs/`에 있는 파일과 e2e의 옛 기준선이 그대로 산다
- `readReplay`(`sim/replay.ts:18`)가 있으면 검증한다: 길이 2 · 서로 다름 · `gods`에 속함. 세 조건은 한 줄이다
- `sim/play.ts`는 시드만 묻는다 — **조합은 안 묻는다.** 파이프 입력의 자리 수가 바뀌면 기존 스크립트가 다 깨지고, CLI로 조합을 고르는 사람은 아직 없다. 필요해지면 `--patrons zeus,ares` 플래그가 그때 붙는다
- 파일명 `god-scales-run-${seed}.json`은 **안 바꾼다** — e2e가 문자열로 대조한다(`tools/e2e.ts:220`)

### 4 · 결과 화면에 조합을 적는다

런 중에는 머리글이 조합을 보여 준다(`ui/header.tsx:44`). 결과 화면만 `시드 N · X/12층`이다(`ui/app.tsx:332`) — 시드가 더 이상 런을 특정하지 못하므로 여기에 조합을 붙인다. **한 줄이다.**

### 5 · e2e — 기준선을 유지한다

`tools/e2e.ts:41`이 setup 화면에서 시드를 채우고 바로 시작한다. 선택이 기본값 그대로면 클릭이 없어도 통과하지만, **그러면 이 계획이 만든 것을 e2e가 한 번도 안 지난다.**

- 시드 170 런은 **제우스+아테나를 명시적으로 클릭**하고 시작한다 — 428결정 기준선이 그대로 남아 회차 비교가 산다
- 그 클릭 뒤 `data-patrons`(또는 머리글 텍스트)로 조합을 대조한다
- 반출 검사(`:221`)에 `patrons` 한 항목을 더한다
- **`:234`의 「봇 기본값과 다른 카드열」은 그대로 둔다.** `run(seed)`가 기본 조합으로 도는 비교인데 브라우저가 제우스+아테나를 고르므로 여전히 같은 조합끼리의 대조다 — 근거를 주석에 적어 둔다. 조합을 바꾸는 날 이 줄이 조용히 무의미해진다
- **두 번째 조합으로 12층을 또 돌지 않는다.** e2e는 체크포인트지 조합 행렬이 아니다(`e2e-test-harness`). 열 조합의 완주 가능성은 `tune`이 이미 매 회차 잰다

---

## 배선

| 자리 | 무엇 |
|---|---|
| `ui/app.tsx:44` | `picked` 상태, `onStart`에서 정렬해 `runSteps(nextSeed, undefined, patrons)` |
| `ui/app.tsx:186` | `.god-legend` → 토글 버튼 다섯, `aria-pressed`, 둘 아니면 submit `disabled` |
| `ui/app.tsx:332` | 결과 eyebrow에 조합 |
| `ui/app.tsx` `reset()` | **조합 선택을 유지한다** — 같은 조합으로 다른 시드를 돌리는 것이 기본 동작이다. 시드 입력이 이미 그렇게 남는다 |
| `ui/export.ts:3` | `replayPayload(seed, actions, patrons)` |
| `sim/replay.ts:16` | `ReplayFile.patrons?`, `readReplay` 검증 |
| `tools/e2e.ts:42` | 조합 클릭 · 대조 · 반출 항목 |
| `ui/style.css` | `.god-legend`의 `span`이 `button`이 된다 — 색 점(`i`)은 그대로 |

**엔진·데이터·봇·게이트는 한 줄도 안 바뀐다.** `botPolicyVersion`·`globalParamVersion`도 그대로다(`core/favor.ts:19`) — 정책도 파라미터도 안 움직였으므로 동결을 깨면 거짓말이 된다.

---

## 함정

- **순서 정규화를 빼먹으면 조용히 다른 게임이 된다.** 시작 덱 비대칭(`sim/engine.ts:335`)이 그 이유고, 화면에는 아무 표시도 안 난다. 「고른 순서를 뒤집어도 같은 결정열」 테스트가 이것을 잡는 유일한 그물이다
- **라이벌 조합을 막지 않는다.** 제우스+포세이돈·아테나+아레스는 `rivals`(`core/demands.ts:31`)지만 융합 카드가 열 조합에 다 있고, 라이벌이라는 것 자체가 난이도 축이다. 「추천 조합」 표시도 안 만든다 — 승률 표를 화면에 내면 최저 셀 조합을 아무도 안 고른다
- **최저 셀 0.208이 이제 사람의 선택지가 된다**([R-34](../reviews/34-tempo.md)). 지금까지 조합 편차는 통계였고 앞으로는 체감이다 — **이 계획이 그것을 고치지 않는다.** 밸런스 게이트는 하한 하나 그대로고, 편차를 새 지표로 만들지 않는다(CLAUDE.md). 리뷰에 「사람이 최저 셀을 고를 수 있게 됐다」를 적는 것으로 끝낸다
- **`grace_*` 시나리오의 70 호의는 `[0]`이 받는다.** 정규화 뒤에는 언제나 `gods` 순서에서 앞선 신이다 — UI는 시나리오를 안 쓰므로 지금은 무해하지만, 시나리오를 화면에 열면 그때 결정이 필요하다
- **옛 replay를 `patrons` 필수로 만들면 `logs/`가 다 죽는다.** 선택 필드인 이유고, 기본값이 하필 제우스+아테나인 이유다
- **`godIds`(데이터 순서)와 `gods`(코드 상수)가 갈릴 수 있다.** 신을 추가·재배열하면 §2의 정렬이 조용히 어긋난다. 두 배열이 같은지 보는 테스트 한 줄이 제일 싸다

---

## 다음 자리 — 이 계획이 안 하는 것

1. **조합 미리보기.** 고른 둘의 시작 덱 10장과 융합 카드를 타이틀에서 보여 주는 것. `godDecks`와 `fusionCards`가 이미 export돼 있으므로 화면만의 일이지만, 시작 화면이 한 눈금(900px)을 넘으면 P-26의 레이아웃 기준이 깨진다
2. **CLI 조합 선택.** `sim/play.ts --patrons`. 사람이 CLI로 여러 조합을 돌려 보고 싶어진 뒤다
3. **조합별 승률 편차를 닫는 것.** 지속성을 못 재는 토큰 가중치(색인의 첫 부채)가 근본이고, 이 계획과는 다른 층의 일이다

---

## 세션 종료

- [ ] `ui/app.tsx` — 토글 다섯 · 둘 강제 · 정렬 후 `runSteps`에 전달 · 결과 화면 조합 · `reset()`이 선택을 유지
- [ ] `ui/export.ts`·`sim/replay.ts` — `patrons` 반출, 선택 필드 + 검증, 기본값 제우스+아테나
- [ ] `ui/style.css` — 범례 버튼
- [ ] `tools/e2e.ts` — 조합 클릭 · 머리글 대조 · 반출 항목
- [ ] `test/` — 열 조합이 다 시작된다(융합 카드 존재) · 고른 순서를 뒤집어도 같은 결정열 · **`data/gods.json`과 `gods` 순서 일치**(UI 모듈을 import하지 않는다) · `patrons` 없는 replay는 제우스+아테나 · 잘못된 `patrons`(길이·중복·미지의 신)는 반려
- [ ] `npx tsc --noEmit` · `npm test` · `npm run tune` 하한 · `npm run e2e`
- [ ] 「사람이 최저 셀 조합을 고를 수 있게 됐다」를 리뷰에 적는다
- [ ] `reviews/38-patron.md` 작성 후 이 파일 삭제

# P-61 · 토큰 배지 — 케니 틀 · 스택 눈금 · 카드 면 범례

관련 [R-57](../reviews/57-token-icons.md) 토큰 아이콘 13종 · [R-54](../reviews/54-statusbar.md) §케니 9-slice ·
[R-53](../reviews/53-overlays.md) 사전 · [R-26](../reviews/26-hud.md) 채널 규칙 · [UI.md](../UI.md)

## 배경

`.token-badge`(`ui/style.css:283`)는 **틀이 전부 CSS다** — 38px 원 · 1px 테두리 · inset 그림자.
P-57이 안의 그림 하나를 전용 픽셀 아이콘으로 바꿨지만 **틀은 그리다 만 자리로 남았다.** 적 발밑의
능력 칩(`.enemy .passive:496`)과 사전의 원(`.token-dict .passive-icon:174`)도 같다.

케니 `fantasy-ui-borders` 팩의 관례가 정확히 이 자리다 — 팩 샘플의 인벤토리 칸이 **9-slice 사각 틀 +
우하단 개수**고, 우리는 이미 그 팩의 두 장을 쓰고 있다(`art/kenney/panel-border-00{7,10}-bronze.png` —
오버레이 셸과 `.primary` 버튼).

스택은 지금 **숫자 하나뿐이다**(우하단 16px 원, `:303`). 눈으로 세는 눈금이 없어서 3스택과 1스택이
같은 크기의 같은 그림이다.

## 확인한 사실

- 팩 조각은 전부 **48×48**이고 모서리 16이다 — 기존 두 줄이 쓰는 `border-image: url(...) 16 / Npx round`가
  그대로 통한다. `PNG/Default/Transparent center/`는 **가운데가 뚫린 틀**이라 배지의 진영 배경이 그대로
  비친다. 배지가 쓸 것은 이 갈래다(`Panel/`은 가운데가 채워져 있어 진영 채움을 덮는다).
- 청동은 **필터가 아니라 사본**이다(R-54): 원본이 흰 알파 PNG라 CSS `filter`를 걸면 틀만이 아니라
  안쪽 내용까지 물든다. `magick`으로 물들인 사본을 `art/kenney/`에 둔다.
- `tools/size.ts`의 `art/kenney` 항목은 `only: [...]` **화이트리스트**다 — 새 조각을 여기 안 적으면
  번들에는 실리면서 게이트에는 안 세어진다. 지금 총량은 4.42/8 MiB고 조각 한 장은 수 KiB다.
- 「여러 겹으로 쌓인 것」의 수법이 이미 이 저장소에 있다 — `.draw-pile i`(`:516`)가 `box-shadow` 두 겹으로
  뽑을 더미를 그린다. 배지도 같은 수법을 쓰면 DOM이 안 는다.
- **클래스 문자열을 보는 테스트가 있다** — `test/ui.test.ts:135~139`가 `"token-badge boon consume"`,
  `"token-badge harmful turn"` 꼴을 본다. 진영·지속 클래스 이름은 못 바꾼다.
- 배지는 세 자리에 선다: 적 발밑 칩 · 병사 칩 · 토큰 사전. 셋 다 `TokenBadge`(`tokens.tsx:74`) 하나다.

## 단계

### 1. 청동 조각 한 장 (에셋)

`PNG/Default/Transparent center/`에서 **38px로 줄여도 모서리 장식이 살아남는** 단순한 틀 하나를 고른다 —
변에 잔무늬가 많은 것은 그 크기에서 회색 죽이 된다. 고른 뒤 `aside`로 실제 크기에서 눈으로 본다.

```
magick "$HOME/Downloads/kenney_fantasy-ui-borders/PNG/Default/Transparent center/panel-transparent-center-0NN.png" \
  -colorspace sRGB -fill '#c6a969' -colorize 100 art/kenney/token-frame-bronze.png
```

`art/kenney/`의 기존 두 장과 같은 방법·같은 자리다(입력은 팩, 출력은 저장소 — art/README.md 규칙 3).
`tools/size.ts`의 `only` 목록에 파일명을 더한다. `ATTRIBUTION.md`에는 케니 항목이 이미 있다.

### 2. 배지를 사각 틀로 (`ui/style.css`)

원 → 사각. **채널 넷은 자리만 바꾸고 수는 그대로다**(R-26: 색 하나에 두 뜻을 싣지 않는다):

| 채널 | 지금 | 이후 |
|---|---|---|
| 진영 | 테두리 색 + 배경 채움 | 배경 채움 그대로 — 틀은 청동 한 색이다 |
| 지속 4종 | `border-style` 점선·파선·외곽선 | **밑변 2px 띠**(`::after`) — 테두리를 틀이 가져갔다 |
| 종류 | 20px 아이콘 · `--token-color` | 그대로 |
| 스택 | 우하단 숫자 | 숫자 + **겹친 틀**(§3) |

```css
.token-badge { border: 6px solid transparent; border-image: url(../art/kenney/token-frame-bronze.png) 16 / 6px round; border-radius: 0; image-rendering: pixelated; }
```

지속 띠는 **색을 새로 만들지 않는다** — `currentColor`(진영색)에 패턴만 다르게 준다: 이번 턴 점선 ·
다음 턴 파선 · 1회 소모 실선 · 전투 내내 두 줄. 지금 `border-style`이 하던 말과 같은 말, 다른 자리다.

38px 안쪽이 6px 틀에 먹히므로 아이콘은 20 → **18px**로 내린다. 배지 크기(38)는 안 바꾼다 — 발밑 칩 줄의
`min-height: 40px`(`:493`)과 사전 격자의 `38px` 열이 그 수를 알고 있다.

### 3. 스택 눈금

`stacks >= 2`면 배지 뒤에 한 겹, `>= 4`면 두 겹. `.draw-pile i`와 같은 `box-shadow` 수법이다:

```css
.token-badge[data-stacks="2"] { box-shadow: 3px 3px 0 -1px #11131a, 3px 3px 0 0 currentColor; }
.token-badge[data-stacks="4"] { box-shadow: 3px 3px 0 -1px #11131a, 3px 3px 0 0 currentColor, 6px 6px 0 -1px #11131a, 6px 6px 0 0 currentColor; }
```

`TokenBadge`는 `data-stacks={stacks >= 4 ? 4 : stacks >= 2 ? 2 : 1}` 한 줄이다. **정확한 값은 계속
숫자가 든다** — 겹은 「많다」를 말하는 눈금이지 값이 아니다. 겹이 오른쪽 아래로 자라므로 스택 숫자
원(`:303`, `right: -3px; bottom: -3px`)과 겹친다 → 숫자를 **우상단**으로 옮긴다(팩 샘플은 우하단이지만
거기는 겹이 없다). 칩 줄은 `flex`라 겹 6px이 이웃을 밀지 않는지 aside로 확인한다.

### 4. 적 능력 칩도 같은 틀

`.enemy .passive`(`:496`)와 `.token-dict .passive-icon`(`:174`)이 같은 조각을 4px로 두른다.
보라색(`#bfa8e0`)은 **그대로 둔다** — 패시브가 토큰이 아니라는 표시가 그 색이고, 틀을 공유해도 색이
갈라 준다.

### 5. 카드 면 범례를 사전에 (사용자 항목 5)

지금 사전은 토큰 13 + 적 능력 8이다. **카드 면의 기호는 어디에도 설명이 없다** — 사거리 막대와 op
글리프가 그 자리다. `TokenDictionary`(`tokens.tsx:126`)에 셋째 목록을 더한다:

| 기호 | 문구 |
|---|---|
| 좌상단 원 | 이 카드를 내는 데 드는 에너지 |
| `▮▯▯▯` | 닿는 칸 — 채운 칸의 적만 대상 |
| 피해·방어·회복 글리프 | 그 효과의 값 |
| 토큰 글리프 | 붙일 토큰과 스택 |
| 「파워」 | 손을 떠나 전투 내내 매 턴 발동 |
| 「전체」 | 사거리 안 모든 적 |
| 「상급」·「융합」 | 카드 등급 |
| 흐린 효과 | 조건이 맞을 때만 붙는 효과 |

문구는 토큰 툴팁과 같은 계열 — **명사형으로 끝낸다**(WRITING.md: 「~한다」로 끝나면 틀린 것).
**그림은 실제 컴포넌트를 세운다**(`<Icon>`·`reachBars`·`.card-kind` 그대로) — 설명용 사본을 그리면
카드가 바뀔 때 사전만 옛 얼굴로 남는다.

오버레이 제목은 「상태 토큰」 → **「토큰과 기호」**(`ui/app.tsx:215`). 전역 버튼 라벨(「토큰」)과
단축키 `T`는 그대로다 — 버튼 글자가 길어지면 우상단 줄의 폭이 흔들린다.

## 하지 않는 것

- **배지 클래스 이름 변경 없음** — `test/ui.test.ts:135`가 보는 문자열이다. 바꾸려면 테스트를 같이
  고쳐야 하는데, 그건 이 계획이 사는 자리(그림)가 아니다.
- 원형 배지로 돌아가는 설정·플래그 없음. 두 얼굴을 남기면 어느 쪽이 정본인지가 코드에 없다.
- 새 아이콘 생성 없음 — P-57의 13장이 그대로 산다.
- 배지 크기·칩 줄 높이 변경 없음(레이아웃이 그 수를 알고 있다).
- 규칙·값·데이터·봇 불변. 밸런스 게이트 재측정 없음.

## 완료 정의

- 배지·능력 칩·사전이 **한 장의 케니 조각**을 공유하고, 진영·지속·종류·스택 네 채널이 전부 남는다.
- 스택 2 이상이 한눈에 두껍고, 정확한 수는 여전히 숫자로 읽힌다.
- 사전이 세 목록(토큰 13 · 적 능력 8 · 카드 기호 8)이고 그림은 전부 실제 컴포넌트다.
- 발밑 칩 줄에서 첫 토큰이 붙어도 이웃이 안 밀린다(UI.md 제1규칙) — 겹 그림자는 흐름 밖이다.
- `npm run size` 통과(새 조각이 `only` 목록에 있고 총량 8MiB 안).

## 검증

```text
npx tsc --noEmit
npm test                 # 179테스트 — 배지 클래스 문자열 넷이 그대로 통과해야 한다
npm run size             # art/kenney only 목록에 새 조각이 세어지는지
npm run e2e              # 클릭 계약 불변 확인
aside 실측               # 배지 세 자리(적 칩·병사 칩·사전) · 스택 1/2/4 · 사전 셋째 목록
```

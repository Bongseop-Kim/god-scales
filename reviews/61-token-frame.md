# R-61 · 토큰 배지 — 케니 틀 · 스택 눈금 · 카드 면 범례

`reviews/61-token-frame.md` · [색인](00-index.md) · 관련 [R-57](57-token-icons.md) · [R-54](54-statusbar.md) ·
[R-53](53-overlays.md) · [R-26](26-hud.md)

## 결론

**통과 · 계획대로에 셋을 고쳤다.** 배지·적 능력 칩·사전이 케니 조각 한 장(395바이트)을 공유한다.
채널 넷은 자리만 바뀌고 수는 그대로다 — 진영은 배경 채움, 지속은 밑변 띠, 종류는 아이콘 색,
스택은 겹 + 숫자. 사전은 세 목록(토큰 13 · 적 능력 8 · 카드 기호 8)이고 셋째의 그림은 전부 카드가
쓰는 클래스·함수 그대로다. 배지 클래스 문자열 넷 불변 · 규칙·값·데이터·봇 불변.

## 조각 고르기 — 32장을 실제 크기로 세워 봤다

`Transparent center/` 32장을 청동으로 물들여 **브라우저에서 38px · `border-image 16 / 6px`로 전부
띄웠다**(`aside`). 계획이 경고한 그대로다 — 변에 잔무늬가 있는 것(016·017·020·025·026)은 그
크기에서 회색 죽이 되고, 기존 두 장(`panel-border-00{7,10}`)은 6px에서 실오라기다. 고른 것은
**028**: 변이 민무늬 한 띠라 밑변 띠가 그 위에 읽히고, 네 귀의 꺾쇠가 16 → 6 축소를 견딘다.

```bash
magick "…/panel-transparent-center-028.png" -colorspace sRGB -fill '#c6a969' -colorize 100 \
  art/kenney/token-frame-bronze.png
```

`tools/size.ts`의 `only` 목록에 넣었다 — 안 넣으면 번들에는 실리면서 게이트에는 안 세어진다.

## 계획과 다른 것 셋

**1 · 겹 그림자의 층 순서를 뒤집었다.** 계획의 `3px 3px 0 -1px #11131a, 3px 3px 0 0 currentColor`는
어두운 사각이 위에 3px 중 2px를 덮어 **색 띠가 1px만 남는다.** 해로움(파랑)은 그래도 보이지만
이로움(`--boon` #e8c377)은 청동 틀(#c6a969) 위의 1px이라 사실상 안 보였다. `currentColor`를 위로
올리고 spread를 −1로 주면 **2px 색 띠 + 1px 어두운 테**가 된다 — 같은 수법, 보이는 두께.

**2 · 스택 숫자가 처음부터 안 보이고 있었다.** `.token-badge small`이 `color: #151821`과
`background: currentColor`를 **같은 요소에** 걸고 있었다 — 다른 속성의 `currentColor`는 그 요소 자신의
`color`를 가리키므로 어둠 위의 어둠이다. 실측: 배지 `rgb(232,195,119)` · 숫자 글자와 배경이 **둘 다**
`rgb(21,24,33)`. 진영색을 `.boon small`·`.harmful small` 두 줄이 다시 적는다. 이 계획이 숫자를
우상단으로 옮기는 계획이고 완료 정의가 「정확한 수는 여전히 숫자로 읽힌다」라 여기서 닫았다.

**3 · 사전 셋째 목록은 `TokenDictionary`가 `children`으로 받는다.** `tokens.tsx`가 `card.tsx`를
import하면 순환인데, `card.tsx`는 **모듈 평가 시점에** `tokenName("mark")`을 부른다(`conditionText`).
평가 순서가 반대로 잡히는 날 TDZ로 터진다 — 오늘 안 터진다는 것은 근거가 아니다. `CardSigns`는
기호가 사는 `card.tsx`에 두고 `app.tsx`가 둘을 겹쳐 준다.

## 구현

- **배지**(`ui/style.css:283~`) — 원 → 사각. `border: 6px solid transparent` + `border-image ... 16 / 6px
  round`. 가운데가 뚫린 갈래라 진영 채움이 틀 밑으로 그대로 비친다. 지속 넷은 `::after` 밑변 띠고
  색은 `currentColor` 하나에 패턴만 다르다(점선·파선·실선·`double` 3px). 아이콘 20 → **18px**,
  배지에 `padding-bottom: 3px` — 26px 안쪽에 18px을 그냥 가운데 두면 띠가 아이콘에 닿는다
- **스택**(`tokens.tsx:74`) — `data-stacks={stacks >= 4 ? 4 : stacks >= 2 ? 2 : 1}` 한 줄. 겹은
  `box-shadow`라 **흐름 밖**이다 — 발밑 칩 줄 높이를 스택 1/2/4로 재서 40 → 40 그대로임을 확인했다
  (UI.md 제1규칙). 겹이 우하단으로 자라므로 숫자는 우상단으로 옮겼다
- **적 능력 칩** — `.enemy .passive`·`.token-dict .passive-icon`이 같은 조각을 4px로 두른다.
  보라(#bfa8e0)는 그대로다 — 틀을 공유해도 「토큰이 아니다」를 그 색이 말한다. 칩의 좌우 여백을
  5 → 3px로 줄여 틀이 먹은 폭을 되돌렸다
- **카드 기호 8줄**(`card.tsx`) — 비용 젬·`reachBars`·효과 글리프·토큰 글리프·「파워」·「전체」·
  등급 칩·흐린 효과. 전부 실제 클래스와 `Object.values(tierNames)`라 카드가 바뀌면 사전도 바뀐다.
  카드에서 절대 배치인 둘(`.cost-gem`·`.card-kind`)만 사전에서 `position: static`으로 줄에 세운다.
  기호 열은 **92px**이다 — 72px에서 「상급」·「융합」이 두 줄로 접혔다
- **오버레이 제목** 「상태 토큰」 → 「토큰과 기호」. 전역 버튼 라벨(「토큰」)과 단축키 `T`는 그대로다

## 하지 않은 것

계획의 「하지 않는 것」 전부 지켰다 — 배지 클래스 이름·크기·칩 줄 높이 불변, 원형으로 돌아가는
플래그 없음, 새 아이콘 없음, 밸런스 게이트 재측정 없음. 색인(`00-index.md`)에는 안 적었다 —
[R-60](60-poses.md)과 같은 자리다.

## 검증

```text
npx tsc --noEmit         통과
npm test                 24파일 · 180테스트 통과 (배지 클래스 문자열 넷 그대로)
npm run size             assets=265 · 6.47/8 MiB · violations=0 (새 조각이 only 목록에 있다)
npm run e2e              e2e ok (10화면 가로 넘침 0 · 39결정 완주 · 재실행 없음)
aside 실측               조각 32장 접촉 시트 · 사전 세 목록 · 배지 세 자리 · 스택 1/2/4 겹과 줄 높이 40 고정
```

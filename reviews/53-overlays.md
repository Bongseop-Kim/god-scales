# R-53 · 오버레이 넷과 전역 아이콘

`reviews/53-overlays.md` · [색인](00-index.md) · 관련 [R-52](52-ui-split.md) · [R-26](26-hud.md)

## 결론

**통과 · 완료 정의 전부 충족.** 오버레이 넷(토큰 사전 · 도움말 · 덱 · 약속 저널)이 모달 셸
하나(`ui/shared/overlay.tsx`)를 쓰고, 전역 아이콘 다섯이 우상단에 선다. 소리 토글은 시작
화면의 버튼을 대체했다. 규칙·값·데이터·봇 불변 — 밸런스는 재측정하지 않았다.

## 구현

- **셸은 네이티브 `<dialog>`다** — `showModal()`이 focus trap·Esc·backdrop을 공짜로 준다.
  라이브러리 0. 닫는 길 셋(Esc·바깥 클릭·×)이 전부 `onClose` 하나로 모인다: Esc는 cancel→close,
  바깥은 backdrop 클릭의 target이 dialog 자신이라는 사실 하나로 갈린다. 열림 상태는 App이
  `useState<OverlayKind>()` 하나로 든다 — URL·저장에 안 실리므로 새로고침하면 닫힌 상태다.
  케니 프레임은 `panel-border-007.png`(흰 알파 PNG) 9-slice + `sepia(.25)`가 청동을 만든다
- **전역 아이콘 다섯** — `.fullscreen`과 같은 규칙(fixed · 셸 밖 · zoom 미적용 · 평소 40%).
  「소리 켜짐/꺼짐」은 글자 수가 같아 폭이 안 흔들린다(UI.md 제1규칙). 덱·약속은 런 밖에서
  지우지 않고 `disabled`로 죽는다 — `pending` 유무가 곧 「런 중」이다
- **토큰 사전** — `tokenStyle` 하나에서 13행을 만든다(`TokenDictionary`, 데이터가 사는
  `tokens.tsx`에 산다). 배지는 `TokenBadge` 재사용이라 진영(외곽/채움)·지속 테두리가 자동으로
  같다. 사전용 사본 0
- **도움말 여섯** — 목표·저울·은혜·요구·쉼터·시작 덱. 문장은 기존 화면 것을 그대로 옮겼고
  (P-54가 걷어낼 상주 설명문들의 새 집), 값 셋은 코드에서 읽는다: `favorBoundaries` ·
  `restHealing` · `deckSize`
- **덱 오버레이(920)** — 읽기 전용 `GameCard`(onSelect 없음 → `<article>`이라 e2e의
  `button.game-card` 후보에 안 잡힌다). **관측 확장 하나**: `RunView`에 `deck: CardView[]`를
  실었다 — `runView()`가 덱·카드 사전을 받아 어느 phase에서나 덱이 관측에 있다.
  `MapObservation`의 중복 `deck`과 `RewardObservation`의 `deck: number`(장수)는 그 자리에
  흡수됐다(보상 배지는 `view.deck.length`)
- **약속 저널** — 진행 중은 지금 관측의 `promises` 그대로, 지킴·깨짐은 App이 `show()`에서
  관측 스트림의 `settled`를 주워 쌓는다(`actions`와 같은 꼴의 표시용 누적 · 게임 상태 아님).
  중복은 `depth:god:rule` 키의 `useRef<Set>` 하나가 막는다 — `settled`는 확정 뒤에도 매
  관측에 실려 오기 때문이다. 줄은 전투 화면의 `.promise`와 같은 얼굴이다

## 하지 않은 것

- 오버레이 열림을 URL·저장에 싣지 않았다. 도움말에 튜토리얼 없음(문단 여섯이 전부).
  덱 오버레이에 정렬·필터 없음 — 정보는 장수뿐이다
- 아이콘을 그림으로 만들지 않았다 — `.fullscreen`과 같은 텍스트 버튼이다. P-54의 상단 바가
  생기면 덱·약속 둘이 그리로 이사한다(한 줄 이동)

## 검증

```text
npx tsc --noEmit    통과
npm test            24파일 · 179테스트 통과 (setup 화면의 disabled 단언을 폼 범위로 좁혔다 —
                    전역 아이콘의 덱·약속이 런 밖에서 disabled인 것은 UI.md대로 정답이다)
npm run e2e         e2e ok — 시드 727 완주 · 아홉 화면 측정 · 자유 덱 왕복 · 반출 재생 일치
aside 실측          아이콘 다섯(덱·약속은 인트로에서 disabled) · 도움말 여섯 항목 · Esc/× 닫힘 ·
                    토큰 13행 · 런 중 덱 10장 · 저널 세 그룹
```

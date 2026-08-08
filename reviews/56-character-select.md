# R-56 · 인트로 메뉴 · 신 선택 캐릭터 셀렉트 · 시드 숨김

`reviews/56-character-select.md` · [색인](00-index.md) · 관련 [R-53](53-overlays.md) · [R-38](38-patron.md)

## 결론

**통과 · 완료 정의 전부 충족.** 시작 화면의 주인공이 초상 다섯이 됐다. 텍스트는 「후원할 신 둘 ·
N/2」와 하단 한 줄뿐이고, 시드 입력은 사라졌다(`?seed=` URL + 반출 JSON이 재현을 든다).
시뮬 통계는 인트로 메뉴로 이사했다. 규칙·값·데이터·봇 불변.

## 구현

- **인트로** — eyebrow(「결정론적 덱빌딩 프로토타입」) 삭제. 메뉴가 제목 아래 좌측 세로 스택
  (폭 220): 게임 시작(케니 `.primary`) · **시뮬 통계**(`<a>` — 페이지 이동이라 버튼이 아니다) ·
  전체화면. 우측 절반은 배경 일러(`hero-title.webp`)의 자리라 비워 뒀다
- **캐릭터 셀렉트** — `SetupScreen`의 조합 칩이 세로 초상 5장(196×560, 원본 2:3
  `object-fit: cover` 상단 정렬)이 됐다. 사이 디바이더 4개는 청동 그라데이션이 위→아래로
  흐르는 2.6s 루프(`prefers-reduced-motion`이면 정지). 상태 셋은 전부 CSS: 기본
  `grayscale(.78) brightness(.5)` · hover/focus 리프트 4px + 채도 복원 + 신 색 테두리(120ms) ·
  선택 원색 + 발광 + 이름판 점등. **「선택 1·2」 배지는 `data-pick` + CSS `content`다** —
  DOM 텍스트에 섞으면 e2e가 `textContent === "제우스"`로 버튼을 못 집는다.
  선택 로직 불변: `toggleGod`의 `slice(-2)` · `aria-pressed` · `patronPair` — 버튼이 그림이 될 뿐이다.
  덱 편집기의 신 탭은 칩(`.god-legend`) 그대로다
- **하단 한 줄** — 배분 슬라이더(500, `SplitField` 그대로 — 둘 아니면 `visibility: hidden`으로
  자리만) · 덱 편집기(접힘 `<details>` 현행) · 런 시작(케니) 오른쪽 끝. h1·lead·`pick-label`
  옛 문구·토큰 범례·힌트 두 줄·통계 링크를 지웠다 — `TokenLegend`는 사용처가 없어져
  컴포넌트째 삭제(사전은 `TokenDictionary`가 `TokenBadge`를 직접 쓴다)
- **시드 숨김** — `seed-field`·`seedInput`·`setCustomValidity` 삭제. 시작 시
  `Math.floor(Math.random() × 2³¹) + 1`을 state에 들고 **반출 JSON에는 그대로 남는다**.
  개발·e2e는 `main.tsx`가 `?seed=`를 읽어 `App`의 `seed` prop으로 넘긴다 — 있으면 매 런
  그 값이라 e2e의 자유 덱 2회차도 같은 시드로 돈다
- **e2e** — `tab.fill("input[type=number]")` 삭제, 진입 URL `?seed=727`. 신 선택 클릭
  (아테나→제우스 정규화 검증)은 초상 버튼에서 그대로 동작 — `aria-pressed` 셀렉터 불변

## 하지 않은 것

- 신 소개문·능력 미리보기 없음 — 이름과 그림뿐, 설명은 도움말이다
- 덱 편집기 개편 없음. 신 테마 프롭 오버레이(목업 §12)는 P-58이다

## 검증

```text
npx tsc --noEmit    통과
npm test            24파일 · 179테스트 통과 (인트로 메뉴 셋 · 초상 5 + data-pick 배지 ·
                    시드 입력 부재 단언으로 갱신)
npm run e2e         e2e ok — ?seed=727 진입, 반출 파일명·헤더 대조 유지, 완주 · 자유 덱 왕복
aside 실측          인트로 좌측 메뉴 스택 · 초상 5장(선택 1·2 배지 · 무채/원색) · 하단 한 줄 ·
                    스크롤 넘침 없음(god-select 1044×560)
```

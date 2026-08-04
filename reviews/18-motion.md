# P-18 리뷰 · 연출과 에셋 배선

판정: React + Motion 전환 및 자동 검증 통과. Aside 브라우저 확인은 `402 Insufficient credits`로 미실행.

| Before | After | Why |
|---|---|---|
| `innerHTML` 즉시 교체 + CSS 진입 키프레임 | `AnimatePresence` 180ms opacity 교차 페이드 | React 수명주기에서 퇴장까지 보장하고 급격한 상태 변화 완화 |
| 버튼 피드백 없음 | 120ms `scale(.97)` press | 고빈도 입력의 즉각적 피드백 |
| CSS 미디어 쿼리만 사용 | `useReducedMotion`에서 화면 전환을 즉시 완료하고 CSS 이동 제거 | 움직임 민감 사용자 지원 |
| 문자열 카드·토큰 마크업 | `GameCard`·`TokenLegend` TSX 컴포넌트 | React 렌더 트리와 이미지 오류 폴백을 일원화 |

- 카드·FX·오디오가 없어도 placeholder·무음으로 완주한다.
- 외부 아이콘 다운로드가 실패해 문자 심벌을 직접 만들었고 귀속 문서에 사실대로 기록했다.
- Motion은 화면 교차 페이드에만 쓰고, 버튼 press·배지·카드 피드백은 CSS transition으로 유지했다.
- `LazyMotion`과 `m`으로 필요한 DOM 애니메이션 기능만 번들에 포함했다.

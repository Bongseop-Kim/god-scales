# R-50 · 컷인이 움직인다 — fx 여섯 4프레임 스트립

`reviews/50-fx-sprites.md` · [색인](00-index.md)

**P-50 범위 통과 · 동시 작업의 전역 게이트 오류는 남음**

`devotion`·`calm`·`anger`·`wrath`·`burst`·`strike`를 1536×960 셀 네 장짜리 6144×960 WebP 스트립으로 교체했다. `playSprite`는 로드한 이미지의 비율로 스트립을 알아내 기존 호출부 변경 없이 500ms `steps(4, jump-end)`를 한 번 재생하고 제거한다. 1프레임 파티클은 기존 480ms 경로, reduced-motion 컷인은 첫 셀과 P-46 문장을 3초 보여 주는 경로 그대로다.

## 에셋과 생성 기록

| fx | 배포본 | inspect |
|---|---:|---|
| devotion | 6144×960 · 34,196B | 통과 |
| calm | 6144×960 · 13,484B | 통과 |
| anger | 6144×960 · 17,838B | 낮은 motion 0.0052 — 가는 균열의 진행을 접촉 시트로 확인 |
| wrath | 6144×960 · 55,494B | 낮은 motion 0.0013 — 제한된 손·사슬 동작을 접촉 시트로 확인 |
| burst | 6144×960 · 30,002B | 통과 |
| strike | 6144×960 · 20,666B | 마지막 잔불 크기 790 vs 9328 — 명세와 일치 |

- 전부 sprite-gen `component-row`의 `codex` 이미지 백엔드로 생성했다. 최종 프롬프트는 각 `art/_src/sprite-runs/fx_{name}/prompts/play.txt`, 원본·추출 프레임·접촉 시트·리포트·판정은 같은 run과 `qa-notes.md`에 보존했다.
- projection + YCbCr로 추출했고 모든 frame의 `edge_pixels`와 `chroma_adjacent_pixels`가 0이다. 배포본은 q90 + alpha-quality 100이다.
- 기존 `art/_src/fx/*.png`는 diff 0으로 입력 원본을 건드리지 않았다.

## 재생 확인

Aside CLI로 전투에서 직접 관측했다.

- 컷인 DOM은 `fx cut strip calm`, 원본 크기 6144×960, `pointer-events: none`이었다.
- 이미지 x 위치가 0 → −1425 → −2850 → −4275px로 한 번 진행하고 약 505ms에 제거됐다. 스트립 밖의 빈 프레임은 보이지 않았다.
- `art/particle/magic_01.webp`는 `fx spark`로 `strip` 클래스와 프레임 애니메이션 없이 기존처럼 약 480ms 뒤 제거됐다.

## 게이트

```text
npm run size             통과 — assets=138, 3.58MiB, violations=0
npx vite build (임시 경로) 통과 — 585 modules transformed
git diff --check         통과
npx tsc --noEmit         실패 — 동시 작업 tools/validate.ts:255의 nullable match
npm test                 실패 — 기존 favor/gate fixture 2건(schema ↔ token_scope), 171/173 통과
npm run art -- --check   실패 — 동시 작업 카드 파일 70장 / 정본 30장, missing 0
npm run e2e              실패 — Aside가 검사 중 탭 navigation/close로 세 번 종료
```

전역 실패 파일과 추가 카드 에셋은 P-50 변경 범위 밖이라 수정·삭제하지 않았다. 같은 Aside CLI로 P-50의 컷인·파티클 동작은 별도 실측했다. 규칙·데이터·봇은 건드리지 않았고 새 밸런스 지표나 측정은 만들지 않았다.

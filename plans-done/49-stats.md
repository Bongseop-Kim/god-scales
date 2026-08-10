# P-49 · 통계 페이지 — 시뮬 실측이 사는 곳

`plans/49-stats.md` · [색인](../reviews/00-index.md)

**크기** 중간 · **착수 조건** 없음

호의 궤적 일회성 분석을 상설 페이지로 승격한다. 내용 셋: **우호도 움직임 · 클리어/실패 · 승리 런의 특징**(승/패 비교 + 조합 매트릭스 + 지역·층별 격파율). Vite 두 번째 진입점으로 GitHub Pages에 같이 배포하고, 데이터는 CI가 매 빌드 생성한다.

집계는 대부분 이미 있다 — `summarize()`(`sim/report.ts:56`)가 조합 매트릭스·단계 비율·격파율·패배 원인을 계산하고 `simulateStratified`(`sim/engine.ts:763`)가 결정론 시드로 층화한다. **새 시뮬 축을 만들지 않는다.**

**경계.** 이 페이지는 리포트이지 게이트가 아니다 — 판정 밴드·회차 비교를 싣지 않는다. 밸런스 판정은 `npm run tune`의 조합 승률 하한 하나다 (CLAUDE.md).

## 완료 정의

```bash
npm run stats                  # public/stats.json — 결정론 (두 번 돌려 같다)
npx tsc --noEmit && npm test   # 집계 단위 + 렌더 테스트
npm run build                  # dist/에 stats.html + stats.json
```

| 항목 | 판정 기준 |
|---|---|
| 데이터 | `tools/stats.ts`가 층화 2000런을 집계해 `public/stats.json`을 쓴다. 커밋하지 않는다(.gitignore) |
| 페이지 | `stats.html` 진입점 — §우호도(Δ 히스토그램·단계 점유·대표 궤적 3) · §클리어/실패(조합 매트릭스·층별 격파율·패배 지점) · §승/패 비교 |
| 스타일 | `ui/style.css` 토큰(신 색 `--{id}`·Galmuri11) 재사용. 차트는 JSX 인라인 SVG, 라이브러리 없음 |
| CI | `pages.yml`이 build 앞에 `npm run stats` 한 줄 |
| 진입 | SetupScreen 하단 링크 한 줄 |
| 게이트 | 없음 — 값만 싣는다. 판정 문장·밴드 금지 |

## 안 하는 것

- 새 시뮬 플래그·축 (`--split`류는 P-46)
- 판정·밴드·회차 비교 (게이트는 tune 하나)
- 차트 라이브러리·라우터 (진입점 분리가 라우팅이다)
- `stats.json` 커밋 (CI 생성물)

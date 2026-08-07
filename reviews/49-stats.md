# R-49 · 통계 페이지 — 시뮬 실측이 사는 곳

`reviews/49-stats.md` · [색인](00-index.md)

**통과 · 완료 정의 전부 충족**

층화 2000런의 집계가 `stats.html`로 상설이 됐다 — §우호도(Δ 히스토그램 · 단계 점유 · 대표 궤적 3) · §클리어/실패(조합 5×5 · 조우 격파율 · 패배 지점·패시브) · §승리 런의 특징(승/패 그룹 비교). **리포트이지 게이트가 아니다**: 판정 문장·밴드·회차 비교가 한 줄도 없고, 밸런스 판정은 여전히 `npm run tune` 하나다.

## 완료 정의 대조

| 항목 | 판정 기준 | 결과 |
|---|---|---|
| 데이터 | `tools/stats.ts` → `public/stats.json`, 커밋 안 함 | **통과** — .gitignore 추가, 세 번 연속 생성 diff 0 (결정론) |
| 페이지 | `stats.html` 진입점 + 세 섹션 | **통과** — `aside repl` 실측: SVG 4 · 섹션 3 · 매트릭스 25칸 · 막대 44 · 가로 넘침 없음 |
| 스타일 | `ui/style.css` 토큰 재사용 · 라이브러리 0 | **통과** — 신 색 `--{id}` · `--boon`/`--bane` · Galmuri11 그대로, JSX 인라인 SVG |
| CI | build 앞 `npm run stats` 한 줄 | **통과** — `pages.yml` |
| 진입 | SetupScreen 링크 | **통과** — hint 한 줄 |
| 게이트 | 새 판정 없음 | **통과** — `computeStats`는 값만 낸다 |

```
npm run stats            public/stats.json — runs=2000 · Δ 39,250스텝
npx tsc --noEmit         통과
npx vitest run test/stats.test.ts   8/8 통과 (합계 검증 · 대칭 · 결정론 · 정적 렌더)
npm run build            dist/stats.html + dist/stats.json · stats 청크 10.25kB
```

## 설계 그대로 된 것

- **집계는 `summarize()` 재사용.** `sim/stats.ts`의 `computeStats`가 매트릭스·격파율·패배 패시브를 `summarize`에서 가져오고, 페이지에만 필요한 것(Δ 분포 · 승/패 그룹 · 대표 궤적)만 직접 센다 — 두 번째 진실을 안 만들었다.
- **대표 궤적은 조건 첫 일치**라 층화가 결정론이면 선택도 결정론이다 (「헌신 안착 승리」·「진노 추락」·「첫 패배」).
- **진입점 분리가 라우팅이다.** `stats.html` + 루트 `stats-main.tsx`(기존 `main.tsx`와 같은 자리 — 계획의 `ui/stats-main.tsx`에서 한 칸 옮겼다) + `vite.config.ts` `rollupOptions.input` 둘.
- 단계 점유는 순서 척도라 한 색 농도 + 라벨, Δ 히스토그램은 |Δ|≥12를 진하게 — 색이 정체를 혼자 들지 않는다.

## 실측이 말한 것 (2000런 · 현 작업 트리 기준)

- Δ 분포는 80런 표본과 같은 이봉 — 가운데 +2·0·−3(드리프트), 바깥 +14·−16·−25(요구). |Δ| 중앙값 **2**, |Δ|≥12가 **26%**.
- 패배는 양 끝에 몰린다: `surface:6`(보스) 409 · `underworld:6`(보스) 299 · **`surface:1` 287** — 지상 진입 직후가 세 번째 사지다.

## 주의

- **동시 작업 오염.** 이 회차 내내 작업 트리에 P-44 계열 미커밋 변경이 살아 움직였다 — 세션 도중 `core/demands.ts`가 바뀌며 승률이 0.412 → 0.420으로 이동했고, 기존 테스트 둘(`demands`·`steps`)이 그쪽 사정으로 빨갛다(이 계획의 파일들과 무관, `test/stats.test.ts`는 8/8). **`stats.json`의 숫자는 커밋 시점의 코드가 정본이다** — CI가 매 빌드 다시 만들므로 스냅샷 드리프트는 없다.
- `aside`의 뷰포트가 앱 창 크기라 좁은 폭 반응형은 CSS 미디어 쿼리 검사까지만 했다.

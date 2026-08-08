# R-58 · 프롭 확대 · 전투 연출

`reviews/58-flourish.md` · [색인](00-index.md) · 관련 [R-55](55-battle-stage.md) · [R-42](42-mapwalk.md)

## 결론

**통과 · 우선 여섯 전부 + 배치표 전부.** 프롭 14종이 아홉 화면 전부에서 역할을 갖고 서고,
우선 연출 여섯이 동작한다. **전부 UI 연출이다** — 규칙·값·봇 불변, `prefers-reduced-motion`에서
전부 정지/생략(정보는 상태 바·커서·숫자가 이미 든다). e2e가 연출을 켠 채 완주했다.

## 프롭 배치 (§12 — 전투 3겹은 P-55가 했다)

`Prop`(이름 → `.sprite` 스팬, pointer-events 없음)과 `regionProp`(층 시드 픽) 둘을
`backdrop.tsx`에 두고 화면들이 가져다 쓴다. 새 에셋 0 — 있는 14종만.

- **지도** — 패널 좌우 원경 2(`flank`) + 보스 층 줄 옆 신호 프롭(지하 `under_tartarus_glow` ·
  지상 `surface_storm_cloud`, `map-wrap` 기준 absolute)
- **결정 화면 5종** — 패널 좌우 바깥 1쌍(층 시드 픽). 쉼터만 모닥불(`tartarus_glow`/`light_shaft`)
  이 패널 아래 중앙 96px
- **신 선택** — 선택된 초상 위 신 테마: 제우스 `lightning_afterglow` · 포세이돈 `droplet` ·
  아테나 `olive_leaf` · 아레스 `ash` · 아르테미스 `eagle`
- **인트로** — 메뉴 옆 `wisp` 둘 부유(`prop-float` 3.4s). **결과** — 승리
  `eagle`+`ribbon`+`light_shaft` / 패배 `ash`+`chain`+`wisp`
- 전부 배경과 UI 사이 absolute 레이어 — 흐름 밖이라 판을 안 민다(UI.md 제1규칙)

## 연출 — 우선 여섯

1. **카드 hover 확대** — 가리킨 카드 1.5×(축은 카드 아래 — 위로 커져 손패를 안 덮는다),
   양옆 카드가 transform으로만 ±34px 물러난다(`:hover + *` · `:has(+ :hover)`) — 여백을
   바꾸면 부채꼴 전체가 다시 접힌다
2. **피격 연출** — 맞은 쪽 흰 플래시 120ms + 셰이크 4px, 때린 쪽 20px 전진(WAAPI).
   「누가 때렸나」는 관측에 없어(맞은 쪽만 든다) **직전 렌더의 공격 의도**로 귀속한다 —
   적 턴 피해가 온 프레임에는 의도가 이미 다음 것이다. `translate`·`filter` 속성이라
   motion의 `transform`(layout·popLayout)과 채널이 안 겹친다
3. **타겟팅 화살표** — 무대 카드 → 커서 점선 베지어(`AimArrow`). `pointermove`가 SVG 경로만
   다시 쓴다 — React 상태를 태우면 마우스마다 리렌더다. P-55 크로스헤어와 한 세트
4. **턴 배너** — 「내 턴/적 턴」 슬림 스윕 400ms(`sweepBanner`, `playSprite`처럼 DOM에 붙였다
   지운다). 적 턴은 「턴 종료」 클릭이, 내 턴은 turn 증가가 420ms 뒤에 낸다(겹침 방지)
5. **에너지 젬 맥동** — 낼 수 있는 카드가 남으면 1.04 pulse(`options`에 카드가 있는가로 판정),
   에너지 0 무채색은 P-55 그대로
6. **단축키** — D 덱 · J 약속 · T 토큰 사전 · ? 도움말 · E 턴 종료 · 1~9 카드. Esc는
   `<dialog>`가 이미 든다. 전부 `answer`의 options 검사를 지나므로 지나간 결정에 눌린 키는
   클릭과 같은 문에서 조용히 무시된다

## 하지 않은 것

- **후순위 여섯**(저체력 비네트 · 패럴랙스 · 승리 슬로모 · 컷인 슬라이드인 · 지도 발자국 ·
  카드 비행 arc) — 계획이 「1·2가 끝나고 남으면, 어디서 멈춰도 된다」로 열어 둔 자리다.
  하나씩 독립이라 다음 플랜이 어디서든 이어받는다
- 새 에셋·사운드·애니메이션 라이브러리 없음 — motion(기존)과 WAAPI로 다 됐다

## 검증

```text
npx tsc --noEmit    통과
npm test            24파일 · 179테스트 통과
npm run e2e         e2e ok — 연출 켠 채 시드 727 완주(232결정), 클릭 계약(data-*·disabled) 불변.
                    첫 실행은 reward overflowX 플레이크(R-52·R-57과 같은 자리) — 재실행 통과.
                    세 번 반복된 플레이크라 다음에 나오면 tools/e2e.ts의 측정 시점을 볼 자리다
aside 실측          인트로 wisp 2 · 초상 테마 프롭 2 · ? 도움말 열림 · 지도 boss-signal+flank 2 ·
                    젬 ready 맥동 · 단축키 1로 카드 발동 → target 진입 · 화살표 DOM 존재
```

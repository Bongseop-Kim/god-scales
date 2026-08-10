# 74 — 전투 다듬기: 과업 접근성, 피격 연출, 카드 점검, 사거리 전면화, 은혜 테두리, 융합 레이아웃

여섯 가지 독립 작업. 순서는 아래대로(사거리 개편(3번)을 먼저 끝내고 전수 점검(4번)이 최종 상태를 검증한다).

공통 제약
- 밸런스 게이트는 `test/matrix.test.ts`의 조합 승률 하한(`winFloor = 0.05`) 하나뿐. 새 지표를 만들지 않는다.
- UI 작업은 `UI.md` 제1규칙(레이아웃 불변, transform/opacity만) 준수.
- 브라우저 확인은 `aside` CLI로만.

---

## 1. 과업을 받고도 다음 전투에 못 가는 문제

현상: omen 노드에서 과업을 받아도, 다음 줄에서 도달 가능한 레인(`core/map.ts:45-48`, lane ±1)에 전투가 없으면 과업이 공중에 뜬다. 과업 슬롯 자체는 만료되지 않고 다음 판정 가능한 전투까지 따라가지만(`sim/engine.ts:797-804`), 그동안 HUD에 보이지도 않아 사실상 죽은 과업처럼 보인다.

수정 (둘 다):
1. **맵 생성 보정** — `core/map.ts` 생성 시, omen 노드마다 다음 줄의 도달 가능 레인(±1) 중 최소 하나가 전투 계열이 되도록 스왑한다. 층별 기존 제약(3층+ 레인 타입 상이, 5층 rest 포함, 6층 boss)과 충돌하지 않는 범위에서만.
2. **이월 과업 표시** — 과업이 판정되지 않고 이월 중일 때도 상태를 보여준다. 전투 밖에선 상단 HUD, 전투 중 `min_enemies` 미달로 판정이 미뤄질 때는 `PromiseRow`(`ui/screens/combat.tsx:653-680`) 자리에 "이월" 표기. 자리는 예약(레이아웃 불변).

만료 카운터·새 페널티는 만들지 않는다.

테스트: `test/map.test.ts`에 "omen 다음 줄에는 도달 가능한 전투가 있다" 생성 불변식 1개. `test/matrix.test.ts` 통과 확인.

## 2. 플레이어 피격 데미지 표시 + 애니메이션

`DamagePop`(`ui/screens/combat.tsx:42-59`)은 이미 플레이어에도 붙어 있다(`combat.tsx:708`, `id="player"`). 할 일은 신규 제작이 아니라 점검·보강:
- 적 턴 피격 시 실제로 팝이 뜨는지 확인 — `recordHits()`(`sim/engine.ts:399-418`)의 `hitSource: "enemy"` 경로가 player pop까지 배선되어 있는지.
- 피격 시 플레이어 쪽에도 가벼운 반응 추가: 기존 `shake()`/hit pose(`combat.tsx:317-352`)를 플레이어 액터에 재사용. transform만, `useReducedMotion` 시 생략(숫자 팝은 유지 — 정보는 연출이 아님).

테스트: `test/ui.test.ts`에 player DamagePop 마크업 어서션.

## 3. 공격 카드 전면 사거리화 + 보스 4칸

현황: 공격 카드 115장 중 32장만 `reach` 보유(미지정 = 0123 전체). 보스 `size`는 코드상 2까지 지원하지만(`core/combat.ts:30-31, 59-68`) 실제 `data/enemies.json`엔 size 설정 자체가 없다(둘 다 1칸).

수정:
1. **reach 전면 부여** — `data/cards.json`의 나머지 공격 카드 83장에 신 정체성대로 배정. 대략: Ares/Athena 근접(0·01), Poseidon 전~중열(01·012), Zeus 산개(03·전체 유지도 허용), Artemis 후열(23·3). 기존 32장은 유지. 전체(0123)를 남길 카드는 의도적으로 소수만(광역 컨셉).
2. **보스 4칸** — `EnemyDefinition.size`를 4까지 허용하고 `createCombat`(`core/combat.ts:59-68`)이 같은 참조를 4슬롯에 채우는지 확인(현 구조상 자동일 가능성 높음 — 확인만). `data/enemies.json`의 두 보스(`enemy_under_boss`, `enemy_surface_boss`)에 `size: 4`. UI는 기존 `--span` 와이드 렌더(`combat.tsx:441-443, 610-614`)가 span 4를 소화하는지 확인.
3. **밸런스** — reach 축소는 실질 너프. `test/matrix.test.ts` 돌려서 하한 미달 조합이 나오면 reach 배정을 넓히는 방향으로만 조정(수치를 깎거나 게이트를 손대지 않는다).

테스트: `test/range.test.ts`에 size 4 보스가 4슬롯 전 reach에 피격되는 케이스 1개. `test/gate.test.ts`/`tools/validate.ts`가 reach 필수를 강제하진 않는다 — 새 검증 규칙은 만들지 않는다(미지정 = 전체라는 기본값은 남는 비공격 카드에 여전히 유효).

## 4. 카드 전수 점검

179장 전부(개편된 reach 상태 기준) 정상 동작 확인. 새 프레임워크 없이:
1. `tools/validate.ts` 전체 통과 확인.
2. 스모크 스윕: 시뮬 러너로 카드 179장을 각각 최소 1회 발동시키는 스크립트(일회성, `tools/` 또는 scratchpad). 발동 시 예외·no-op(효과 텍스트가 있는데 상태 변화 0)인 카드를 목록화.
3. 발견된 버그는 카드별이 아니라 공유 경로(`core/rules.ts`, `core/targeting.ts`)에서 원인 수정. 수정마다 기존 테스트 파일(`test/dsl.test.ts`, `test/combat.test.ts`, `test/range.test.ts`)에 회귀 케이스 추가.

발견 목록과 수정 내역은 리뷰 문서에 남긴다.

## 5. 은혜 표시: 우상단 토큰 → 테두리 대각 채움

현행: 카드 우상단 `.card-seals` 원형 배지(`ui/shared/card.tsx:276, 285-294`, `ui/style.css:679-682`).

변경:
- 모든 카드 테두리 기본 회색.
- 은혜 1개: 테두리를 대각선으로 갈라 한쪽 절반을 해당 신 색(`--seal-color`)으로. 2개: 반대쪽 절반을 두 번째 신 색으로.
- 구현은 CSS로: 테두리를 conic-gradient 배경 + 안쪽 판 겹침(또는 border-image)으로 그린다. 대각 분할은 conic-gradient 각도 2개로 충분. 카드 크기·레이아웃 불변, 색만 바뀐다.
- `previewSeal`(융합 미리보기)의 `.preview` 반투명 처리도 같은 방식으로 이관.
- `.card-seals` 배지와 예약 공간(min-width/height 22px), 범례(`card.tsx:155-156`)의 배지 표기 제거·갱신.

테스트: `test/ui.test.ts`의 seal 마크업 어서션을 테두리 방식으로 교체.

## 6. 융합 연출 레이아웃 변경

현행: `.fusion-scene` 3열 그리드(신 | 카드 | 신, `ui/app.tsx:321-336`, `ui/style.css:684-704`).

변경: 신 둘을 작게 좌·우 상단에, 카드는 중앙 하단에.
- 마크업 순서는 유지하고 CSS만으로 해결 가능하면 CSS만: grid 영역 재배치 + `.fusion-god` 축소.
- 슬라이드 인/크로스페이드/스킵 버튼/`prefers-reduced-motion` 분기는 그대로 재사용. 이동은 transform, 등퇴장은 opacity.
- 신 발화 타이밍(`app.tsx:133-139`)은 손대지 않는다.

테스트: `test/ui.test.ts` 융합 씬 마크업 어서션 갱신. `aside`로 육안 확인.

---

## 완료 기준

- `vitest run` 전체 통과(밸런스 게이트 포함).
- `aside`로 전투 피격 팝, 은혜 테두리, 융합 연출, 보스 4칸 육안 확인.
- 완료 후 `reviews/74-combat-polish.md` 작성, 이 플랜 삭제.

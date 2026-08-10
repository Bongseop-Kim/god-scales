# P-41 · 앞줄부터 채운다 — 빈 칸 없는 배치, 두 칸짜리 보스, 네 마리 조우

`plans/41-pack.md` · [◀ R-40](../reviews/40-free.md) · [색인](../reviews/00-index.md)

**크기** 중간 · **착수 조건** 없음. [P-35](../reviews/35-range.md)의 4칸 판과 [P-36](../reviews/36-shove.md)의 밀어내기 위에 얹는다

지금 판은 `[적, null, null, 적]`처럼 **빈 칸을 사이에 두고** 선다(`data/enemies.json`의 12개 편성 중 6개). 실측 조우 인원은 `{1: 10052, 2: 9365, 3: 2173, 4: 306}` — 열 판 중 넉 판이 **혼자 선 적 하나**다. 4칸 판을 만들어 놓고 대부분의 전투가 1인 조우다.

이 계획은 셋을 바꾼다.

1. **빈 칸을 없앤다.** 편성은 언제나 칸 0부터 붙여 채운다
2. **보스는 두 칸을 차지한다.** 칸 0·1에 서고, 두 칸 어디로도 맞는다
3. **조우는 네 마리다.** 그래서 전투가 길어지고, 그만큼 수치를 내린다

---

## 완료 정의

**모든 일반·정예 조우가 칸 0~3을 빈틈없이 채우고, 보스가 두 칸에 서고, 조합 승률 하한을 그대로 넘는다.**

```bash
npx tsc --noEmit && npm test
npm run validate -- data/enemies.json data/map.json   # 반려 0
npm run tune                                          # 조합 승률 하한 0.05
npm run build && npm run e2e
```

| 항목 | 판정 기준 |
|---|---|
| 빈 칸 | `Lineup`에 `null`이 없다. 타입에서 사라진다 — 데이터가 다시 구멍을 적을 수 없다 |
| 인원 | 배포된 모든 `combat`·`elite` 편성이 **4인**이다. `regionBands.count`가 `[4, 4]` |
| 보스 | 보스 하나가 칸 0·1을 차지한다. 사거리 `1`·`01`·`12`가 보스에 닿고, 피해는 **한 번만** 들어간다 |
| 보스 행동 | 두 칸에 서도 한 턴에 **한 번** 행동한다. 출혈·`spite`·`rally`도 한 번씩 |
| 밀림 | 두 칸짜리는 안 밀린다 — `displace`는 소모되고 자리는 그대로(맨 뒤 불발과 같은 자리) |
| 화면 | 보스가 두 칸 높이로 그려진다. 같은 보스가 두 판에 겹쳐 뜨지 않는다 |
| 게이트 | `winFloor = 0.05`를 **안 내리고** 넘는다. 못 넘으면 적 수치를 더 내린다 |

---

## 설계

### 1 · `null`을 타입에서 지운다

빈 칸은 세 군데에서 왔다. 하나만 남긴다.

| 출처 | 지금 | 뒤 |
|---|---|---|
| 편성 데이터의 `null` | `[a, null, null, b]` | **삭제** |
| 죽은 적이 남긴 자리 | 시체가 그 자리에 남는다 | **그대로** — StS와 같다. 아무도 밀려 오지 않는다 |
| 4인 미만 조우 | `emptySlot`으로 채운다 | **보스전만** 남는다(§3) |

- `core/combat.ts:26` `Lineup = (EnemyDefinition | null)[]` → `EnemyDefinition[]`
- `core/combat.ts:66-69` `createCombat`의 `definition ? … : emptySlot(slot)` — 뒤쪽 남는 칸에만 `emptySlot`(보스전용)
- `sim/engine.ts:128` `EnemyData.groups[].with: (string | null)[]` → `string[]`, `sim/engine.ts:172` `id === null` 분기 삭제
- `tools/validate.ts:376` `slotFailure`의 `id === null` 분기, `tools/validate.ts:398` `groupStrength`의 `.filter(id => id !== null)` 삭제

`emptySlot`은 **남긴다.** 시체와 같은 꼴이라 `hp > 0` 필터가 전부 그대로 도는 자리(`core/combat.ts:47-51`)는 안 건드린다.

### 2 · 자리 규칙을 「표」에서 「순서」로

`roleSlots`(`tools/validate.ts:366-370`)는 역할마다 칸 번호를 못 박는다. 앞줄 역할 `[0,1]` · 뒷줄 역할 `[2,3]`.

**4인으로 붙여 채우면 이 표는 조합을 죽인다.** 저승의 뒷줄 역할은 `pressure`·`zealot` 둘뿐이라, 표를 지키면 저승 4인 편성은 **칸 2·3이 언제나 압박+광신도**다. 앞 둘만 바뀌는 편성 여섯 개가 전부다.

표를 순서 규칙 하나로 바꾼다.

```
앞줄 역할(guardian·attrition·brute·swarm)이 뒷줄 역할(pressure·applier·support·zealot)보다 뒤에 서면 반려
```

- 뿌리(칸 0)가 앞줄 역할이어야 한다는 기존 계약은 그대로 따라온다 — 순서 규칙의 첫 항이다
- 저승 4인이 「앞 셋 + 뒤 하나」·「앞 둘 + 뒤 둘」 어느 쪽으로도 설 수 있다
- `boss`·`god`은 규칙 밖이다(지금과 같다)
- 반려 키 `slot_scope`는 그대로 쓴다 — **새 실패 종류를 만들지 않는다**

### 3 · 보스는 **같은 객체를 두 칸에** 세운다

`EnemyState`에 `slot`을 넣지 않는다(`core/targeting.ts:13`의 「두 번째 진실」). 칸은 여전히 배열 인덱스다. 두 칸짜리는 **같은 `EnemyState` 참조를 인덱스 0과 1 양쪽에 둔다.**

```
[케르베로스] [케르베로스] [빈 칸] [빈 칸]     ← 같은 객체. 체력 막대는 하나
      ↑ 사거리 0·1 둘 다 이것에 닿는다
```

| 안 | 대가 |
|---|---|
| **A (고른다)** 같은 참조를 두 칸에 | 순회 네 곳에 중복 제거가 필요하다. 대신 체력·토큰·패턴이 **하나**라 두 번째 진실이 안 생긴다 |
| B 칸 1에 「몸통」 표식 엔티티 | 체력이 둘이거나, 표식이 사거리 `1`에 안 잡혀 뒷줄 카드가 보스전에서 죽는다 |
| C `EnemyState.slot` + 폭 필드 | 인덱스=칸 계약이 깨진다. `livingInReach`·`slot()` DSL·밀림·입장이 전부 재작성 |

**A의 대가는 중복 제거 다섯 줄이 전부다.**

- `EnemyDefinition`에 `size?: number`(보스만 `2`). `createCombat`은 앞부터 채우며 `size`만큼 **같은 객체**를 반복해 넣고, 칸 합이 `MAX_SLOTS`를 넘으면 지금처럼 던진다
- `core/targeting.ts:16` `livingInReach`가 **동일성으로 중복을 지운다** — 여기 한 곳이면 `resolveTargets`·`resolveChainTargets`·`canReachTarget`이 전부 따라온다. 안 지우면 `all_enemies`가 보스를 두 번 때린다
- 배우 목록을 도는 네 곳은 `[...new Set(combat.enemies)]`로 읽는다: `endTurn`의 적 행동 루프(`core/combat.ts:193` — **두 번 행동하면 이 계획이 난이도 개편이 된다**), 출혈(`:213`), `spite`(`:162`), `rally`(`:88`)
- `shoveDisplaced`(`core/rules.ts:165`): 두 칸을 차지한 적(`indexOf !== lastIndexOf`)은 건너뛴다. 토큰은 소모된다 — 맨 뒤 불발과 같은 자리다. **보스는 부동이다**
- `admitPending`(`core/combat.ts:100-111`)은 그대로다 — 보스가 죽으면 두 칸이 함께 비고, 가장 앞부터 채운다
- `slot(target)` DSL(`core/rules.ts:208`)의 `findIndex`는 보스에 0을 준다. 보스는 앞줄이다

**보스는 혼자 선다(칸 2·3은 빈다).** 판 전체를 채우려면 보스 층 편성 데이터·밴드·재측정이 딸려오고, 그것은 이 계획이 아니다. 두 칸을 차지하는 것만으로 이미 값이 생긴다 — 사거리 `1`·`12`·`01` 카드가 보스전에서 처음으로 산다.

화면(`ui/combat.tsx:161-188`)은 `EnemyView`에 `span`을 싣고, `span: 2`면 다음 칸의 빈 칸 자리표시를 건너뛰고 `grid-row: span 2`로 그린다. `sim/engine.ts:327`은 별칭을 **동일성으로 한 번만** 내보낸다 — 안 지우면 같은 보스가 두 판에 뜬다.

### 4 · 조우는 네 마리 — 데이터 12개를 다시 쓴다

`data/enemies.json`의 편성 12개를 전부 `with` 3개로 채운다. `data/map.json`의 층별 갈래 배정은 **안 건드린다** — 편성 id가 그대로 살아 있으면 지도는 안 움직인다.

| 지역 | 앞줄 역할 | 뒷줄 역할 |
|---|---|---|
| 저승 | guardian · attrition · brute · swarm | pressure · zealot |
| 지상 | guardian · attrition | pressure · applier · support · zealot |

- 층당 `combat` 갈래는 지금 수를 유지한다 — 갈래가 줄면 같은 층이 매번 같은 적을 뱉는다
- 정예 둘(`group_surface_hunt`·`group_surface_line`)은 이미 4인이라 인원은 그대로다. §5의 수치 조정만 받는다
- 편성 이름은 인원이 바뀐 만큼 다시 붙인다(`group_under_brute_solo`가 4인이면 이름이 거짓말이다)

### 5 · 밸런싱 — 손잡이는 둘, 게이트는 하나

조우 인원 평균이 **1.7 → 4.0**이다. 체력 총량과 들어오는 피해가 함께 오른다. 손대는 손잡이는 둘뿐이다.

| 손잡이 | 지금 | 방향 |
|---|---|---|
| 개체 체력(`data/enemies.json` 일반 적) | 저승 30~40 · 지상 35~46 | **대략 절반**. 조우 총 체력을 지금 자리에 남긴다 |
| `enemyDamageScale`(`core/map.ts:22`) | 0.55 | 내린다. 때리는 입이 2.3배가 됐다 |

- **카드·값 표(`tools/value.ts`)·`winFloor`은 안 건드린다.** 게이트는 조합 승률 하한 하나이고, 통과 못 하는 값을 테스트에 넣지도 깎지도 않는다
- 순서: ① 개체 체력을 반으로 → ② `npm run tune` → ③ 결과를 보고 `enemyDamageScale`을 **한 번** 조정 → ④ 다시 `tune`. 그래도 하한을 못 넘으면 체력·배율을 더 내린다
- `regionBands`(`tools/validate.ts:405-408`)의 `count`는 `[4, 4]`로 못 박는다. **`hp`·`damage` 밴드는 안 옮기는 것이 1순위** — 개체 값을 반으로 줄이면 4인 총합이 지금 밴드 안에 들어온다. 못 맞춰 옮기면 옮긴 이유와 폭을 리뷰에 적는다
- 조우가 길어지는 것 자체는 `TURN_LIMIT = 50`이 받는다. 실측 시간 초과 비율이 오르면 그것도 리뷰에 적는다

---

## 손대는 파일

| 파일 | 무엇 |
|---|---|
| `core/combat.ts` | `Lineup`에서 `null` 제거 · `EnemyDefinition.size` · `createCombat` 앞부터 채우기 · 순회 네 곳 중복 제거 |
| `core/targeting.ts` | `livingInReach` 동일성 중복 제거 |
| `core/rules.ts` | `shoveDisplaced`에서 두 칸짜리 건너뛰기 |
| `core/map.ts` | `enemyDamageScale` |
| `sim/engine.ts` | `with: string[]` · `encounter`의 `null` 분기 삭제 · 보스 `size: 2` · `EnemyView.span`과 별칭 중복 제거 |
| `ui/combat.tsx`, `ui/style.css` | 두 칸 높이 보스 판 |
| `tools/validate.ts` | `roleSlots` → 순서 규칙 · `null` 분기 둘 삭제 · `regionBands.count` |
| `data/enemies.json` | 편성 12개 4인화 · 일반 적 체력 |
| `test/range.test.ts`, `test/enemies.test.ts`, `test/gate.test.ts`, `test/ui.test.ts` | 빈 칸 전제·자리 규칙·보스 두 칸 |

## 안 하는 것

- `EnemyState.slot` 필드 — 칸은 배열 인덱스 하나다
- 크기 3 이상의 적 — `size`는 보스의 `2`만 쓴다
- 보스 부하 — 보스는 혼자 서고 칸 2·3은 빈다
- 새 지표·밴드·회차 비교 — 게이트는 조합 승률 하한 하나다
- 사거리 어휘·`reachOk`·카드 값 표

## 리뷰에 적을 것

`reviews/41-pack.md`에, 바꾸기 전/후로:

| 지표 | 왜 |
|---|---|
| 조합 승률 하한 통과 여부 · 최저 셀 | 게이트 |
| 승률 · 조우당 평균 턴 수 · 시간 초과 비율 | 「전투가 길어진다」가 얼마나였나 |
| 사거리별 실제 사용 비율 | 빈 칸을 없앤 값이 여기서 나온다 — R-35의 `3` 0.0%가 움직였나 |
| 최종 개체 체력과 `enemyDamageScale` | 몇 번 만에 하한을 넘겼나 |

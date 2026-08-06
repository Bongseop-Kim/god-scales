# P-35 · 거리 — 적 4칸 · 카드 사거리 · 빈 자리로 들어오는 신

`plans/35-range.md` · [◀ P-33](33-icons.md) · [색인](../reviews/00-index.md)

**크기** 중간 · **착수 조건** 없음. 규칙·데이터·화면·봇을 한 번에 건드리므로 P-32·P-33(그림)과 겹치지 않는다

조우에 **자리**를 만든다. 지금 `combat.enemies`는 순서 없는 목록이고 모든 공격 카드가 아무 적에게나 닿는다 — 대상 선택이 「체력 낮은 놈」 하나뿐인 이유다. 자리를 넷으로 못 박고 카드에 닿는 칸을 주면, 처치 순서와 편성 배치가 결정이 된다. 그리고 진노한 신이 **들어설 자리**가 생긴다([R-30](../reviews/30-intervention.md)의 §2, 색인의 「진노 콘텐츠가 없다」).

---

## 완료 정의

**적이 넷까지 서고, 카드가 닿는 칸이 갈리고, 자리가 없으면 신이 문 앞에서 기다린다.**

```bash
npx tsc --noEmit && npm test
npm run validate -- data/enemies.json    # 반려 0
npm run tune                             # 조합 승률 하한 0.05
npm run e2e                              # 12층 완주 + 여덟 화면 1440px
```

| 항목 | 판정 기준 |
|---|---|
| 4칸 | 편성 4인이 최소 한 층에 서고, 다섯째는 `createCombat`이 던진다 |
| 사거리 | 네 모양(`any`·`front`·`front3`·`back`)이 다 쓰이고, 닿지 않는 적은 대상 목록에 없다 |
| 신의 입장 | 4칸이 꽉 차면 대기, 적이 죽어 빈 칸이 생기면 **그 칸**에 선다 |
| 게이트 | `npm run tune` 하한만 본다. 새 지표·밴드를 만들지 않는다 (CLAUDE.md) |
| 화면 | 4칸이 1440px에서 안 넘치고, 손패 캡션이 사거리를 말한다 |

---

## 설계

### 1 · 자리는 배열 인덱스다 — 새 필드를 만들지 않는다

`combat.enemies`는 이미 배열이고 시체가 `hp: 0`으로 남는다(`core/combat.ts:166`이 그것으로 승리를 잰다). **인덱스가 곧 칸이다.**

```
칸 0      칸 1      칸 2      칸 3
앞 ←—————————————————————————→ 뒤
```

- **0이 앞**(플레이어와 가까운 쪽), **3이 뒤**
- 죽은 적은 자리를 비운 채 배열에 남는다 — **아무도 밀려 오지 않는다**. StS와 같고, 그래야 「빈 칸」이 신이 들어설 자리로 그대로 쓰인다
- `EnemyState`에 `slot`을 넣지 않는다. 두 번째 진실이 된다
- 편성의 순서가 곧 배치다 — `data/enemies.json`의 `groups[].with` 순서가 칸 1·2·3이다. 새 필드 없음
- 상한 4는 `createCombat`이 던져서 지킨다(`core/combat.ts:29`). 게이트도 `with.length <= 3`을 본다

`MAX_SLOTS = 4`를 `core/combat.ts`에 상수로 둔다 — 지금 `laneCount`가 3을 박아 둔 것과 같은 자리다.

### 2 · 카드 사거리 — 선택 필드 하나, 모양 넷

`Card`에 `reach?: Reach`를 더한다. **없으면 넷 다 닿는다** — 배포된 카드 129장이 한 줄도 안 바뀐다.

| `reach` | 닿는 칸 | 뜻 |
|---|---|---|
| (없음) = `any` | 0·1·2·3 | 기본값 |
| `front` | 0 | 앞 한 칸 |
| `front3` | 0·1·2 | 앞열 셋 |
| `back` | 3 | 뒤 한 칸 |

```ts
// core/targeting.ts
export const reachSlots = { any: [0, 1, 2, 3], front: [0], front3: [0, 1, 2], back: [3] } as const;
```

`back3`(1·2·3)은 **넣지 않는다.** 다섯째 모양은 그것을 요구하는 카드가 생길 때 넣는다.

- `resolveTargets`가 `reach`로 한 번 더 거른다 — `enemy`는 고른 적이 사거리 안이어야 하고, `all_enemies`는 **사거리 안의 산 적 전부**다
- `resolveChainTargets`도 같은 필터를 탄다. 연쇄가 사거리를 넘으면 `front` 카드가 전체 공격이 된다
- **사거리 밖만 남은 `target: enemy` 카드는 낼 수 없다.** `resolveTargets`가 던지는 대신 `sim/engine.ts:278`의 `affordable`에서 빠진다 — 손패에서 비활성으로 뜬다. `all_enemies`는 그대로 낼 수 있고 아무도 안 맞는다(적이 다 죽은 지금과 같다)
- 적의 행동에는 사거리를 주지 않는다. 뒷칸 적도 지금처럼 플레이어를 친다 — **적 사거리는 안 만든다**(뒷줄이 안전지대가 되면 그때 만든다)

**1단계로 신별 2장씩 10장에만 붙인다.** 아레스 도끼·처형 → `front`, 아르테미스 관통·급소 → `back`, 포세이돈 광역 → `front3` 식이다. 규칙이 먼저 서야 몇 장이 옳은지 실물에서 보인다. 값은 안 만진다 — 사거리를 좁히는 것은 순수한 하향이므로 `expectedValue`가 재는 값이 그대로면 게이트가 반려하지 않는다(§함정에 그 대가가 있다).

### 3 · 신의 입장 — 큐 하나, 입장 자리 둘

`CombatState`에 `pending: string[]`(적 정의 id)을 더한다. 조우 안에서만 산다.

**진노가 큐에 넣는다.** `data/gods.json`의 `wrath.on_encounter_start`에 `{ op: "join", god: "zeus", target: "self" }` 한 줄이고, `applyFavorStageEffects`는 **큐에만 넣는다** — 즉시 입장시키지 않는다(규칙이 한 줄이 되고, 아래 별칭 함정을 구조적으로 피한다). 이미 판에 서 있거나 큐에 있는 신은 다시 넣지 않는다.

**입장은 `admitPending(combat, definitions)` 하나가 한다.** 호출부는 둘뿐이다:

1. 조우 시작 개입 직후 (`sim/engine.ts:211`)
2. `endTurn` 맨 끝 — 적 행동·출혈·감전 청소가 다 끝난 뒤 (`core/combat.ts:155` 앞)

규칙:
- 빈 칸이 없으면 아무 일도 없다. **큐는 그대로 기다린다**
- 빈 칸이 여럿이면 **가장 앞(인덱스 최소)** 이다
- 시체를 그 자리에서 밀어낸다 — `defeated`는 이미 찍혀 있어 `rally`가 두 번 세지 않는다(`core/combat.ts:159`)
- 신의 정의는 조우 시작에 `enemyMap`(사전)에 미리 다 들어 있다. **판(`combat.enemies`)과 사전(`definitions`)을 갈라 둔다** — 그래야 `endTurn`의 `definitions.get`이 던지지 않고 `startTurn` 시그니처가 안 바뀐다

**카드 실행 중에는 절대 입장하지 않는다.** `executeCard`가 `chainTargets`를 카드 시작에 잡아 두므로(`core/rules.ts:241`) 실행 중 배열이 변하면 방금 들어온 신이 진행 중인 연쇄에 맞거나 별칭이 깨진다.

### 4 · 데이터

| 파일 | 무엇 |
|---|---|
| `data/enemies.json` | 4인 편성 그룹 최소 하나(지상 4·5층). `groups[].with`가 셋 |
| `data/enemies.json` | **신 적 5종** — `tier: "god"`, 지역 없음. 실효 체력은 지상 편성 상한(124) 위, 패턴 3칸, 패시브 하나 |
| `data/map.json` | 그 4인 그룹을 층 후보에 배치 (`unplaced_groups` 게이트가 안 배치된 그룹을 잡는다) |
| `data/gods.json` | 다섯 신의 `wrath`에 `join` 한 줄 |
| `data/cards.json` | 10장에 `reach` |

`tier` 유니온에 `"god"`을 더한다 — 보스 뽑기(`sim/engine.ts:114`)가 `tier === "boss"`로 거르므로 신은 편성에 안 섞인다.

**신을 죽이면 적 하나를 처치한 것뿐이다.** 호의는 안 움직인다 — 진노를 카드로 되돌리는 길은 이 계획이 만들지 않는다.

### 5 · 배선

| 자리 | 무엇 |
|---|---|
| `sim/bots/rule.ts:226` `chooseTarget` | 사거리 안에서만 고른다. 정렬 규칙은 그대로 |
| `sim/bots/rule.ts:70` `cardValue` | `all_enemies` 배수를 **사거리 안의 산 적 수**로 센다 |
| `sim/bots/rule.ts:17` | `botPolicyVersion` v7 → **v8** |
| `core/favor.ts:19` | `globalParamVersion` v6 → **v7** |
| `test/freeze.test.ts:8` | 두 버전 문자열 갱신 |
| `ui/combat.tsx:71` | 적 패널이 4칸이다. 빈 칸도 자리를 지킨다 — 남은 적이 앞뒤 어디였는지 보여야 한다 |
| `ui/card.tsx:23` | 캡션에 사거리 (`앞 · …` / `앞 셋 · …` / `뒤 · …`) |
| `tools/validate.ts:127` | `reach` 값 검사, `with.length <= 3`, `tier: "god"` |

`aria-label`도 칸을 말한다 — 색·위치만으로는 스크린 리더가 앞뒤를 모른다(`ui/combat.tsx:86`).

---

## 함정

- **사거리는 순수한 하향인데 `expectedValue`는 그것을 못 잰다.** 값 밴드(4~8)를 그대로 통과하는 카드가 실제로는 약해진다 — 승률이 내려가면 `tune` 하한이 잡는다. 값 표를 고쳐서 미리 보정하지 않는다. 재보고 나서 데이터로 되돌린다
- **`averageEnemies = 2`를 4로 올리지 않는다**(`tools/value.ts:34`). 올리면 광역·연쇄 카드 전부가 재가격되고 129장에서 `value_outlier` 반려가 쏟아진다. 4칸 편성이 몇 층에 서는지가 정해진 뒤 실측 평균으로만 움직인다
- **4인 편성은 확실히 어렵다.** 하한을 깨면 다이얼은 둘 — 4인 그룹을 놓은 층 수, 신 적의 체력. 통과 못 하는 값을 테스트에 넣지도 깎지도 않는다(CLAUDE.md)
- **`guard` 재지정이 사거리를 뚫는다**(`core/rules.ts:200`). 앞칸 지킴이가 뒷칸 공격을 대신 받는 건 옳지만, `back` 카드가 지킴이 때문에 앞칸을 때리게 된다 — 재지정도 사거리 안으로 제한할지 결정하고 리뷰에 적는다. **기본값: 제한하지 않는다**(지킴이가 사거리를 막는 것이 그 패시브의 값이다)
- **`hit_targets_in_turn` 천장이 3에서 4로 오른다.** `target_spread` 요구가 3에서 천장을 만나던 부채([R-29](../reviews/29-quest.md)의 §천장)가 이 계획으로 열린다 — 하지만 **요구 임계를 이번에 손대지 않는다.** 4칸 편성이 얼마나 자주 서는지 재고 나서다
- **스냅샷에 `pending`이 생긴다.** `runCombat`의 `snapshots`(`core/combat.ts:203`)와 반출 재생이 같은 꼴을 읽어야 한다 — 옛 반출 파일로 재생하는 테스트가 있으면 같이 본다
- **빈 칸을 화면에서 지우면 안 된다.** `sim/engine.ts:253`이 `living()`만 실어 보내므로 관측에 칸 번호가 없다 — `EnemyView`에 칸을 실어야 UI가 구멍을 그릴 수 있다
- **e2e의 빈 칸 검사**(`tools/e2e.ts:245` `halfEmpty`)가 의도적으로 빈 4칸 패널을 「빈 화면」으로 반려할 수 있다

---

## 세션 종료

- [ ] `core/combat.ts` — `MAX_SLOTS = 4`, 다섯째는 던진다, `pending`, `admitPending`, `endTurn` 끝 호출
- [ ] `core/targeting.ts` — `reachSlots` 표, `resolveTargets`·`resolveChainTargets` 필터
- [ ] `core/rules.ts`·`core/state.ts` — `Card.reach`, `CombatState.pending`
- [ ] `core/favor.ts` — `join` op은 큐에만 넣는다, `globalParamVersion` v7
- [ ] `sim/engine.ts` — 사전/판 분리, 개입 뒤 `admitPending`, `affordable`에서 사거리 없는 카드 제외, `EnemyView`에 칸
- [ ] `sim/bots/rule.ts` — `chooseTarget`·`cardValue` 사거리, `botPolicyVersion` v8
- [ ] `data/` — 4인 편성 + 지도 배치, 신 적 5종, 진노 `join` 5줄, 카드 10장 `reach`
- [ ] `tools/validate.ts` — `reach`·`with.length`·`tier: "god"` 검사
- [ ] `ui/combat.tsx`·`ui/card.tsx` — 4칸 패널(빈 칸 유지), 사거리 캡션, `aria-label`
- [ ] `test/` — 사거리 필터 · 연쇄가 사거리를 안 넘음 · 4칸 상한 · 꽉 찬 판에서 대기 · 빈 칸에 입장(가장 앞) · 카드 실행 중 입장 없음
- [ ] `npx tsc --noEmit` · `npm test` · `npm run validate` · `npm run tune` 하한 · `npm run e2e`
- [ ] `guard` 재지정과 사거리의 관계를 실물로 보고 결정 기록
- [ ] `reviews/35-range.md` 작성 후 이 파일 삭제

# P-44 · 카드가 늘어난다 — 값이 아니라 모양이 늘고, 업그레이드가 티어를 올린다

`plans/44-cards.md` · [◀ P-43](../reviews/43-shell.md) · [색인](../reviews/00-index.md)

**크기** 큼 · **착수 조건** **[P-39](../reviews/39-tier.md) 완료.** 업그레이드는 「tier1 카드가 tier2 카드가 된다」이므로 계단이 있어야 올라갈 곳이 생긴다

카드 149장 중 **59장이 서로 중복이다** — 값과 코스트를 지문에서 빼고 재면 그렇다. `block|draw@self` 하나에 열 장이 서 있다. 게이트가 그것을 통과시킨 이유는 지문이 `op:floor(값/3)`이라 「방어 4·뽑기 1」과 「방어 12·뽑기 1」을 다른 카드로 봤기 때문이다.

이 계획은 **카드의 정체성을 효과의 모양으로 옮긴다.** 그러면 다음 카드는 새 모양이어야 하고, 새 모양을 만들 어휘가 모자라므로 그 어휘를 같이 넣는다. 그리고 그렇게 늘어난 tier2가 **업그레이드의 도착지**가 된다 — 새 카드를 만드는 일과 업그레이드를 만드는 일이 한 작업이다.

조인 지문은 후보만 잰다. 배포된 149장은 그대로 통과한다.

---

## 완료 정의

**값만 다른 카드가 게이트에서 반려되고, 휴식처·요구가 카드를 tier2로 올리며, 조합 승률 하한이 그대로다.**

```bash
npx tsc --noEmit && npm test
npm run validate -- staging/<새 카드 파일>   # 값만 다른 후보가 duplicate로 반려된다
npm run cards                               # CARDS.md 재생성
npm run tune                                # 조합 승률 하한 0.05 — 이 계획의 유일한 밸런스 판정
npm run e2e
```

| 항목 | 판정 기준 |
|---|---|
| 지문 | 효과의 모양 · 대상 · 사거리 · 훅이 정체성이다 |
| 배포분 | `data/cards.json` 149장이 지금 값 그대로 게이트를 통과한다 (`upgradesTo`만 새 키로 붙는다) |
| 조건 | 새 조건 여섯이 `evaluateCondition`과 게이트의 `conditionPatterns` **양쪽**에서 돈다 |
| tier2 | 신당 3장 → 6장. 3자리를 채우는 `rewardOffer`가 계속 선다 |
| 업그레이드 | 휴식처 3택, 요구 보상. 승격은 **다른 카드가 되는 것**이다 |
| 게이트 | 조합 승률 하한 하나로 판정한다 (CLAUDE.md) |
| 재생 | 배포된 replay가 지금 그대로 재생된다 — 기존 RNG 스트림을 그대로 쓴다 |

---

## 설계

### 1 · 지문을 효과의 모양으로 옮긴다 — 3줄

`tools/validate.ts`의 `fingerprint`가 지금 값을 3으로 나눠 든다. 그것이 「작은 번개(5)와 큰 낙뢰(11)는 다른 카드」의 출처다.

```ts
/**
 * 카드의 정체성은 **효과의 모양**이다 — 피해 5와 피해 11은 같은 카드의 두 숫자고, 그것을 다른
 * 카드로 세면 풀이 늘어난 것이 아니라 같은 결정이 반복되는 것이다.
 *
 * 대상과 사거리는 정체성에 든다: 격랑(`all_enemies`/`012`)과 관통 사격(`23`)은 같은 `damage`여도
 * 판 위에서 다른 일을 한다 — 그 둘이 P-35가 만든 축이다. 훅도 든다(파워는 같은 효과가 다른 시점이다)
 */
function fingerprint(card: Card): string {
  const shape = card.effects.map(({ op, token, when }) => `${op}${token ? `:${token}` : ""}${when ? "?" : ""}`).join("|");
  return `${shape}@${card.target}/${card.reach ?? fullReach}${card.trigger ? `/${card.trigger}` : ""}`;
}
```

`when`은 **있는지 없는지만** 든다 — 조건식까지 지문에 넣으면 조건 문자열만 바꿔 같은 카드를 다시 낼 수 있다.

`duplicateFailure`가 후보를 배포분과 비교하므로 149장끼리는 다시 재지 않는다. 이 한 줄이 바뀌는 순간 아래 자리는 **닫히고**, 새 카드는 §2의 어휘로 간다:

```
10장  block|draw@self       정전기 호흡·계시·폭풍의 눈·번개 통찰·깊은 숨·결의·전략적 후퇴·숲의 은신·달의 가호·은빛 장막
 6장  block|heal@self       회복 전류·온기의 섬광·방패 세우기·물러서 여미기·분노의 인내·사냥꾼의 엄폐
 5장  block@self · energy@self · damage@enemy(작은 번개·큰 낙뢰·은빛 화살)
 4장  damage|self_damage@enemy · draw@self · damage|damage?@enemy
```

### 2 · 어휘는 조건 여섯이다

§1이 닫은 만큼 연다. **가장 싼 어휘는 조건이다** — `evaluateCondition`이 이미 정규식 여섯을 들고 있고 그중 셋(`turn`·`deck_count`·`enemy_count`)은 카드가 아직 안 쓴다. 조건은 **이미 있는 효과가 언제 붙는지**를 바꾸므로 `executeCard`의 분기도 값 표의 무게도 그대로다.

| 새 조건 | 여는 축 | 읽는 곳 |
|---|---|---|
| `cards_played_in_turn >= N` | 콤보 · 다단 히트의 보상 | 새 카운터 |
| `attacks_in_turn >= N` | 다단 히트 | 새 카운터 |
| `energy_spent_in_turn >= N` | 에너지를 모아 때리기 | 새 카운터 |
| `hand_count >= N` · `< N` | 손패 조작 | `combat.hand.length` |
| `hp_pct(target) < N` | 처형 · 치명타의 긴장 | 이미 있는 상태 |
| `block(self) >= N` | 방어를 피해로 — **아테나의 빈 정체성** | 이미 있는 상태 |

카운터 셋만 새 상태다. `CombatState`에 숫자 셋, `playCard`에서 증가, `startTurn`에서 0. 다섯 줄이다.

```ts
/** 이번 턴에 낸 것. `startTurn`이 0으로 돌리고 `playCard`가 센다 — 조건 셋이 이것만 읽는다 */
turnPlays: { cards: number; attacks: number; energy: number };
```

**`evaluateCondition`과 `tools/validate.ts`의 `conditionPatterns`를 같은 커밋에서 고친다.** 두 곳이 같은 여섯을 알아야 게이트가 통과시킨 조건을 엔진이 실행한다 — §0의 부채가 그 어긋남이었다.

값 표는 그대로 둔다. 조건 붙은 효과는 `expectedValue`가 이미 `conditionRate 0.5`로 반값을 매긴다.

치명타 축도 여기서 선다 — `hp_pct(target) < 30`, `attacks_in_turn >= 3`이 같은 도박을 내면서 재현된다. 배수는 `crit`(다음 공격 ×2)과 `mark`(그 적이 ×1.5)가 이미 들고 있고 아르테미스가 그 곱을 갖는다.

### 3 · 업그레이드는 승격이다

값의 계단은 [P-39](../reviews/39-tier.md)가 이미 놓았다. 그 위를 그대로 쓴다:

```json
{ "id": "card_zeus_01", "name": "작은 번개", "upgradesTo": "card_zeus_31" }
```

- 승격은 **다른 카드가 되는 것**이다. tier1 `[4, 8)` → tier2 `[8, 10)`이고 모양도 바뀐다 — §1과 정합한다
- `upgradesTo`는 tier1 카드가 갖는다. 게이트가 잰다: **같은 신 · tier가 정확히 하나 위 · 존재하는 id**
- 도착지를 가진 카드만 휴식처에 뜬다 — 「업그레이드할 게 있는 덱」이 덱 구성의 결과가 된다
- 융합(tier3)은 은혜 둘이 여는 자리로 남는다([`canFuse`](../core/fusion.ts))

### 4 · 도착지를 만든다 — tier2를 신당 3 → 6장

지금 tier2는 신당 정확히 3장이고 정예·보스 보상이 세 자리를 **전부** tier2로 채운다(`tier2Slots`). 3장이면 그 셋이 매번 같이 뜬다. 승격 도착지까지 여기서 나오므로 배로 늘린다.

새 카드는 §2의 조건을 써야 §1을 통과한다. 신별 방향:

| 신 | tier2 세 장이 여는 것 | 쓰는 조건 |
|---|---|---|
| 제우스 | 이번 턴 낸 카드가 쌓일수록 커지는 연쇄 | `cards_played_in_turn` |
| 포세이돈 | 앞칸을 밀어 뒤로 보낸 뒤 후열을 때리는 조합 | `slot(target)`([P-36](../reviews/36-shove.md)) + `hand_count` |
| 아테나 | **쌓은 방어를 피해로 바꾼다** — 지금 없는 정체성 | `block(self)` |
| 아레스 | 손패가 얇을수록 세지는 공격 | `hand_count <` |
| 아르테미스 | 체력이 낮은 적을 마무리한다 | `hp_pct(target)` |

**`exhaust`와 cost 0을 여기서 쓴다.** 태그도 게이트 보정(×0.6)도 이미 있는데 배포 0장이고, cost 0도 게이트가 허용하는데 0장이다 — 새 코드 없이 값의 모양을 넓히는 자리다.

### 5 · 획득 경로 셋

**휴식처** — `takeRest`의 `choice`에 `"upgrade"`를 더한다. 회복·제거와 3택이고, 카드 id를 받는 자리는 `"remove"`가 이미 같은 꼴이다.

```ts
export function takeRest(state, patrons, deck, choice: "heal" | "remove" | "upgrade", cardId?: string): void
```

덱의 그 자리를 `upgradesTo`로 **바꾼다** — 덱 길이가 그대로여야 자유 모드의 열 장이 열 장으로 남는다([P-40](../reviews/40-free.md)).

**요구 보상** — `DemandReward`에 `upgrade?: number`. 서열은 사전식 한 단이 는다:

```
은혜 > 업그레이드 > 호의
```

`rewardRises`가 지금 (은혜, 호의) 둘을 사전식으로 재므로 가운데에 끼운다. 세 값을 각자의 단으로 두는 것이 P-28·P-29가 두 번 고른 길이다.

**전투 신 이벤트** — 다음 계획의 자리다. 진노가 신을 적으로 부르는 경로(`queueEnemy`)가 이미 있으므로 이벤트는 그 위에 선다.

---

## 순서

1·2·3은 서로 의존한다. 4~6은 3이 끝난 뒤 어느 순서로도 된다.

| 단계 | 내용 | 판정 |
|---|---|---|
| 1 | 지문 옮기기 (`fingerprint` 3줄) | 값만 다른 후보가 `duplicate`로 반려 · 배포 149장 통과 |
| 2 | 조건 여섯 + 턴 카운터 셋 (`core` 2파일 · 게이트 1파일) | 엔진과 게이트가 같은 여섯을 안다 |
| 3 | 새 카드 — tier2를 신당 6장으로, tier1도 조건 축으로 몇 장 | `npm run validate` 전원 통과 · `npm run tune` 하한 유지 |
| 4 | `upgradesTo` + 게이트 규칙 | 없는 id·다른 신·티어 역행이 반려 |
| 5 | 휴식처 3택 (`core/map.ts` + UI 1곳) | 덱 길이 불변 · E2E |
| 6 | 요구 보상 `upgrade` (`core/demands.ts` + 게이트 서열) | 단조 검사 통과 |

`npm run cards`로 `CARDS.md`를 다시 만드는 것이 3·4의 끝이다.

---

## 정할 것

- **tier2 장수.** 신당 6이면 정예·보스에서 한 번에 뜰 조합이 20가지다. `tier2Slots`가 3자리를 요구하므로 하한은 3이고, 늘리는 쪽은 언제든 열려 있다
- **휴식처 3택에서 업그레이드의 세기.** 하한 하나로 재고, 움직이면 `restHealing` 대신 업그레이드 쪽을 조인다 — 회복 25는 다른 계획들이 이미 기대고 있는 숫자다
- **`weaken`(적이 주는 피해 영구 −X)의 소유 신.** 침수(1회 −1)의 지속판이라 포세이돈 안에서 계단이 서고, 신 어휘는 `data/gods.json`이 정한다. §2의 조건만으로 30장이 서는지 본 뒤에 꺼낸다

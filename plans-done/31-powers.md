# P-31 · 지속 효과와 상태 어휘

`plans/31-powers.md` · [◀ P-25](25-enemies.md) · [색인](../reviews/00-index.md) · [P-27 ▶](27-map.md)

**크기** 중간 · **착수 조건** [P-25](25-enemies.md)와 **같은 세션**

**실패 시 행동** 조합 하한 0.05(`npm test`)가 깨지면 **파워 카드의 수치를 내린다.** 다섯 장뿐이라 되돌리기가 싸다.

---

## 왜 P-25와 같은 세션인가

트리거 넷의 훅이 P-25의 훅 넷과 **같은 함수의 같은 줄**이다(아래 표). 나눠 하면 `dealDamage`를 두 번 수술하고 두 번 회귀시킨다.

그리고 은혜는 카드와 같은 `Effect` DSL을 쓴다. **어휘가 굳기 전에 은혜를 만들면 은혜를 두 번 만든다** — `data/graces.json`을 뽑아 놓고 `power`·`thorns`가 생기면 전부 다시 본다. 그래서 P-28은 이 계획 뒤에 선다.

---

## 완료 정의

**신 다섯이 각자 다르게 굴러가는 이유를 카드가 갖는다.**

```bash
npm run validate                                   # 위반 0
npm run sim -- --runs 2000 --stratified
#   → 파워 카드의 card_win_delta 가 상위 10장 안에 신마다 하나씩
#   → 아테나 완화 비율 ≤ 0.30 유지 (thorns 는 완화가 아니다)
npm run sim -- --runs 2000 --stratified --policy-matrix
#   → shell 을 낀 조우에서 token 정책이 1위 (bleed 가 답이 된다)
npm test                                           # 조합 하한 0.05 통과
npm run tune                                       # ⚠(|차이| ≤ 0.10) 늘지 않았는지 본다 — 보고만
```

---

## 지금 상태

**우리 카드 효과는 전부 즉발이다.** 전투 내내 남는 건 적에게 붙는 `mark` 하나뿐이다(`core/rules.ts:74`).

토큰 9종을 스택 방식으로 갈라 보면 슬레이 더 스파이어의 네 갈래를 이미 다 쓰고 있다 — 이름만 없다.

| 방식 | 우리 토큰 |
|---|---|
| Intensity — 수치 누적 | `shock`(스택당 +1) · `bulwark`(흡수 풀) · `bleed`(틱마다 1 감소) |
| Counter — 횟수 소모 | `frenzy` · `crit` · `soaked` · `deflect` · `displace` |
| Non-stacking — 켜짐/꺼짐 | `mark`(×1.5 영구) |
| Duration — 턴 수 | 없다 (`shock`이 1턴 고정인 게 유일) |

이 분류를 `core/state.ts`에 명시한다. P-25의 `tokenLimits`와 P-26의 지속 표시가 같은 표를 읽는다 — **두 번째 진실을 만들지 않는다.**

---

## 조사

### 슬레이 더 스파이어 · 파워

버프·디버프 어휘가 200종을 넘는데, 그중 **Power** 종류가 우리에게 통째로 없다. 전투 내내 남아 매 턴 일하는 카드다.

| StS 파워 | 우리로 |
|---|---|
| Demon Form — 턴 시작 힘 +X | 턴 시작 `frenzy` 1 · **아레스** |
| Metallicize — 턴 끝 방어 +X | 턴 끝 `bulwark` 2 · **아테나** |
| Noxious Fumes — 턴 시작 전 적군에 독 | 턴 시작 전 적군 `bleed` 1 · **아르테미스** |
| Thousand Cuts — 카드 낼 때마다 전체 피해 | 카드 낼 때마다 전 적군 `shock` 1 · **제우스** |
| Envenom — 무방비 피해 시 독 부여 | 무방비 피해 시 `soaked` 1 · **포세이돈** |

**신마다 하나씩 정체성 카드가 서는 자리다.** 지금 조합이 다르게 느껴지는 축은 카드 수치뿐이고, 조합 승률이 6.7%~62.7%로 벌어진 이유가 거기 있다.

### 슬레이 더 스파이어 2 · Doom — 그리고 왜 안 넣는가

「Doom이 남은 HP 이상이면 죽는다.」 P-25의 `shell`(한 턴에 X 넘게 잃지 않는다)에 대한 답으로 넣으려던 것이었다.

**답은 이미 있다.** `tickBleed`(`core/combat.ts:99`)는 `dealDamage`를 타지 않고 `actor.hp`를 직접 깎는다. P-25가 `shell`을 `dealDamage`에 넣는 순간 — 그리고 그것이 P-25가 정한 자리다 — **`bleed`가 `shell`을 그냥 통과한다.** 위 정책 행렬 게이트(「shell 조우에서 token 정책 1위」)도 bleed로 그대로 선다.

토큰 하나, 체력 의존 가격 근사 하나, `gods.json` 배정 하나가 통째로 빠진다. 넣지 않는다.

### 다키스트 던전 2 · DOT는 하나면 된다

출혈·역병·화상 셋을 두지만 「본질적으로 같은 방식으로 작동」하고 저항 종류만 다르다. **우리는 저항 개념이 없으므로 `bleed` 하나로 충분하다.** DOT를 늘리지 않는다 — 그리고 위에서 봤듯 그 하나가 이미 두 일을 한다.

---

## 설계

### 1 · 파워 — 태그 하나와 트리거 넷

`Card.tags`에 `power`를 더한다. 그 태그가 붙은 카드는 효과를 **즉시 실행하지 않고 등록한다.**

```ts
// core/state.ts
type Power = { cardId: string; trigger: Trigger; effects: Effect[] };
type Trigger = "turn_start" | "turn_end" | "on_play" | "on_unblocked";
// CombatState 에 powers: Power[]
```

트리거 넷의 훅 자리는 **P-25가 이미 다 여는 곳이다:**

| 트리거 | 훅 | P-25가 여는 이유 |
|---|---|---|
| `turn_start` | `startTurn` | — |
| `turn_end` | `endTurn` | `ramp` |
| `on_play` | `playCard` | `spite` |
| `on_unblocked` | `dealDamage` | `angry` |

발동은 `executeCard`의 효과 루프를 그대로 탄다. **새 실행 경로를 만들지 않는다.**

- 파워는 `exhaust`처럼 버려지지 않는다 — 전투가 끝나면 `clearEncounterTokens`와 같은 자리에서 비운다
- 같은 파워를 두 번 내면 두 개 등록된다(StS와 같다). 상한은 두지 않는다 — 덱에 두 장 넣는 것 자체가 비용이다

### 2 · `thorns` — 상시 반격

- 이로운 토큰(`selfTokens`에 들어간다). Intensity, 소모되지 않는다
- `dealDamage(attacker, target, amount)`에서 `target.tokens.thorns`만큼 attacker에게 되돌린다
- `deflect`(1회 완전무효 + 전액 반사, 가중치 10)와 다른 축이다 — 가시는 매번 소량이고 피해를 막지 않는다
- **아테나가 완화 말고 가질 수 있는 축이다.** P-22가 완화 비율을 0.30으로 눌러놨고, "방어를 공격으로 바꾸면 더 강해진다"는 이미 실측으로 틀린 게 확인됐다. 가시는 셋째 방향이다
- 아테나 전용
- **P-25의 반사 판정을 그대로 탄다** — 가시 피해는 `dealDamage`가 실제로 `hp`를 깎으므로 상대의 `angry`를 발동시킨다. 「막았는데 적이 세진다」가 되고 그건 좋은 상호작용이다. 반면 `deflect`로 완전 무효화된 공격은 `curl`·`angry`를 발동시키지 않는다

**여유가 얇다.** 아테나 장당 EV가 5.16이고 상한이 5.5다(`poolValueMax`). 가시가 완화 비율에 안 잡히는 대신 장당 EV에는 그대로 얹힌다 — 카드당 0.34가 전부다. 아테나 카드 하나를 지우고 넣는 쪽이 될 수 있다.

### 넣지 않는 것

- **퍼센트 완화**(Weak·Frail·Vulnerable). 우리 완화는 전부 정액(`soaked` −1)이고 적 피해는 1층 6~10 → 12층 14~22로 자란다 — 정액이 후반에 무가치해지는 건 사실이다. 하지만 이건 00-index의 「완화의 종류를 구분하지 못하는 가중치」와 같은 뿌리다. **게이트 가중치를 먼저 고치고 나서 손댈 일이지 토큰만 추가할 문제가 아니다**
- **손패·에너지 방해**(Entangled·Confused·No Draw). `ENERGY_PER_TURN = 3`이 123장 카드 가격과 봇 정책의 기준선이다
- **DOT 추가 종류.** 저항이 없으니 `bleed`와 중복이다
- **Intangible**(모든 피해를 1로). 보스 급 강도라 밴드가 감당 못 한다

---

## 게이트 — 여기가 진짜 일이다

### 파워의 기대값 — 식을 짜기 전에 다섯 장을 재라

`expectedValue`(`tools/value.ts:24`)는 효과를 **한 번** 센다. 턴 시작 `frenzy` 1은 7턴이면 일곱 번 일한다. 지금 식이면 4~8 밴드를 그냥 통과하고 실제로는 밴드 밖이다.

원래 계획은 이랬다:

```
파워 EV = 효과값 × (조우 평균 턴 − 카드가 나온 평균 턴)
```

**카드 다섯 장에 새 EV 모델은 과하다.** 두 번째 항(파워가 몇 턴째에 나오는가)은 관측조차 없어서 계측기를 새로 붙여야 하고, 그 상수가 이 계획에서 제일 위험한 다이얼이 된다 — 잘못 잡으면 다섯 장이 전부 밴드를 뚫거나 전부 쓸모없어진다.

순서를 뒤집는다:

1. **고정 배수 4로 시작한다.** 6회차 `avg_turns=79.41` ÷ 조우 11~12회 ≈ 조우당 7턴, 파워가 중반에 나온다고 보면 대략 그 절반이 남는다. 근사라는 것을 주석에 적는다
2. **2000런에서 다섯 장의 `card_win_delta`를 직접 본다.** 다섯 장이면 식이 아니라 실측이 싸다
3. 배수는 그 결과로 조정하고 이전 값과 사유를 리뷰에 남긴다

계측기(파워 등장 평균 턴)는 실측이 배수와 크게 어긋날 때만 붙인다.

### `thorns`는 완화가 아니다

`mitigationTokens`(`tools/value.ts:21`)에 **넣지 않는다.** 가시는 받는 피해를 줄이지 않는다. 이게 아테나 완화 비율 0.30을 안 건드리고 아테나를 강화할 수 있는 이유고, 잘못 분류하면 그 이점이 사라진다.

### `token_scope`

`thorns` → 아테나를 `data/gods.json`에 넣는다. 게이트는 이미 신별 허용 토큰을 잰다(`tools/validate.ts:130`) — 규칙 추가 없이 데이터 한 줄이다.

`FailureKey`는 전부 기존 것(`value_outlier`·`token_scope`)을 재사용한다. **새 키를 만들지 않는다.**

---

## 함정

- **파워는 승률 승수다.** 카드 한 장이 7턴을 일하면 덱 전체의 기울기가 바뀐다. 32,000런 전에 2000런으로 방향부터 본다
- **토큰이 9종 → 10종이 된다.** `tokenNames`·`tokenWeights`·`selfTokens`·`gods.json`·P-26 HUD가 늘어난다. `harmfulTokens`는 `selfTokens`에서 파생되므로(P-25) 자동으로 맞는다
- **적에게 가시가 붙는 경로는 만들지 않는다.** 양쪽에 있으면 반사가 순환한다
- **`data/cards.json` 123장을 다시 뽑지 않는다.** 파워 카드는 **추가**다. 기존 카드의 가격이 바뀌지 않아야 P-22·P-23의 기준선이 산다
- **추가 전에 삭제를 본다.** 파워 다섯 장을 얹기 전에 `card_win_delta`(`sim/report.ts:75`)에서 하위를 훑는다 — 123장 중 안 쓰이는 장이 있으면 그쪽이 더 싼 개선이다. 사용 **횟수** 관측은 없으므로 `cardsPlayed` 집계 한 줄을 붙여 같이 본다
- `enemyDamageScale`을 만지지 않는다

---

## 세션 종료

- [ ] 스택 방식 분류(Intensity·Counter·Non-stacking·Duration)를 `core/state.ts`에 명시
- [ ] `power` 태그 + `Power` 등록 + 트리거 넷 (P-25 훅 재사용), 픽스처 `16-power-trigger.json`
- [ ] `thorns` 토큰, `gods.json`에 아테나 배정, `selfTokens`에 추가
- [ ] 파워 EV **고정 배수 4로 시작** → 2000런 `card_win_delta` 실측으로 조정, 이전 값과 사유를 리뷰에
- [ ] `thorns`를 `mitigationTokens`에 넣지 않았는지 확인
- [ ] 아테나 장당 EV 5.5 상한 확인 — 넘으면 카드 하나를 지우고 넣는다
- [ ] 신당 파워 카드 최소 1장, `npm run validate` 위반 0
- [ ] `cardsPlayed` 집계 한 줄 — 파워 얹기 전에 하위 카드를 먼저 본다
- [ ] 아테나 완화 비율 ≤0.30, `shell` 조우에서 token 정책 1위, `npm test` 조합 하한 0.05 — **깨지면 파워 수치를 내린다**
- [ ] `reports/round-7/ledger.md`에 2000런 스냅샷 한 줄
- [ ] `reviews/31-powers.md` 작성 후 이 파일 삭제

---

## 참고

- [Slay the Spire Wiki · Powers data](https://slaythespire.wiki.gg/wiki/Module:Powers/data) — 버프·디버프 전체 어휘, 파워 종류
- [StratGG · Slay the Spire 2 Powers](https://www.stratgg.com/powers/) — 스택 방식 4분류, Doom
- [Darkest Dungeon Wiki · Damage over Time (DD2)](https://darkestdungeon.wiki.gg/wiki/Damage_over_Time_(Darkest_Dungeon_II)) — DOT 3종이 기능상 동일
- [Darkest Dungeon Wiki · Tokens](https://darkestdungeon.wiki.gg/wiki/Tokens) — 소모형 vs 만료형

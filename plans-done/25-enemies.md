# P-25 · 적 개성

`plans/25-enemies.md` · [색인](../reviews/00-index.md) · [P-31 ▶](31-powers.md)

> **[P-31](31-powers.md)과 같은 세션이다.** 파워 트리거 넷이 이 계획이 여는 훅 넷(`startTurn`·`endTurn`·`playCard`·`dealDamage`)과 같은 함수의 같은 줄이다 — 나눠 하면 `dealDamage`를 두 번 수술하고 두 번 회귀시킨다.

**크기** 큼 · **착수 조건** 없음

**실패 시 행동** 패시브가 조합 하한 0.05(`npm test`)를 깨면 **그 조합에 나오는 패시브 수치를 내린다.** 하한을 옮기지 않고 `enemyDamageScale`도 만지지 않는다.

---

## 완료 정의

**어느 고정 정책도 모든 조우에서 1등이 아니다.** 그것이 "다채롭다"의 정의다.

`sim/runner.ts`에 고정 정책 넷을 붙인다 — `--policy`.

| 정책 | 행동 |
|---|---|
| `single` | 가장 비싼 공격 카드를 체력 최저 적에게 |
| `spread` | 광역·연쇄 카드 우선 |
| `turtle` | 방어·완화 카드 우선, 남는 에너지만 공격 |
| `token` | 토큰 부여 카드 우선 |

**봇을 넷 만들지 않는다.** `cardValue`(`sim/bots/rule.ts:20`)가 이미 효과별 항을 더한다 — 정책은 그 항에 곱하는 가중치 넷이고 각각 열 줄이다. 두 번째 봇을 만들면 `v4` 기준선과 비교가 끊긴다.

```bash
npm run sim -- --runs 2000 --stratified --policy-matrix
#   → 조우마다 1위 정책이 있고, 한 정책의 1위 점유율 ≤ 50%
#   → 1위와 4위의 승률 격차가 조우당 10%p 이상 (조우가 답을 요구한다)
```

**변경 전 값을 먼저 재고 리뷰에 적는다.** 지금은 `single`이 거의 전 조우 1위일 것이다 — 그 숫자가 기준선이다. 바꾼 뒤에도 독식이면 독식이라고 쓴다.

---

## 지금 상태

`data/enemies.json` 실측 — 적 7종의 패턴:

| 적 | 패턴 | 길이 | 패시브 |
|---|---|---:|---|
| 저승의 추격자 | `damage 10` | 1 | 없음 |
| 망각의 파수꾼 | `damage 4` | 1 | 없음 |
| 저승문지기 (보스) | `damage 18` → `block 8` | 2 | 없음 |
| 지상의 돌격병 | `damage 10` | 1 | 없음 |
| 지상의 수호병 | `damage 6` | 1 | 없음 |
| 지상의 사제 | `soaked 1` → `damage 4` | 2 | 없음 |
| 올림포스의 집행자 (보스) | `damage 24` → `block 12` | 2 | 없음 |

`EnemyAction`이 갖는 것은 `damage`·`block`·`token`·`stacks` 넷뿐이다(`core/combat.ts:11`). **패시브라는 개념 자체가 없다.** 적은 매 턴 같은 일을 하고, 플레이어가 무엇을 하든 반응하지 않고, 서로를 모른다.

토큰 9종이 다 구현돼 있어도(`core/rules.ts:59`) 적이 거는 건 사제의 `soaked` 하나다.

---

## 조사 — 세 게임의 적 어휘

### 슬레이 더 스파이어 · 의도(intent) 7종

「보통 적은 턴마다 하나 — 피해 / 상태이상 / **아군 지원** / 방어 / ???. 보스는 둘을 겹친다(피해+방어).」 복합 의도가 따로 있다: 공격+방어, 공격+디버프, 방어+버프.

우리는 다섯 중 **셋만** 갖고 있다. 아군 지원과 ???가 통째로 없고, 복합은 보스 둘이 turn을 나눠 쓰는 것뿐 한 턴에 겹치지 않는다.

### 슬레이 더 스파이어 · 패시브 어휘

적 전용 파워가 40종 넘는다. 우리 구조에 그대로 오는 것들:

| 파워 | 원문 | 무엇을 처벌하는가 |
|---|---|---|
| `Hardened Shell` | 한 턴에 X 넘게 체력을 잃지 않는다 | **단일 대형 피해** |
| `Curl Up` / `Skittish` | 처음 맞을 때 방어 X를 얻는다 | 찔끔찔끔 때리기 |
| `Enrage` | 스킬(비공격)을 낼 때마다 힘 +X | 방어 일변도 |
| `Artifact` | 디버프 X개를 무효화한다 | **토큰 일변도** |
| `Crab Rage` | 아군이 죽으면 힘 +6, 방어 +99 | 아무나 먼저 죽이기 |
| `Minion` | 리더가 없으면 전투를 이탈한다 | (반대 방향) 리더를 먼저 |
| `Territorial` / `High Voltage` | 턴마다 힘 +X | 장기전 |
| `Angry` | 공격 피해를 받으면 힘 +X | 나눠 때리기 |

`Gremlin Nob`(Enrage)은 「1막 정예 셋은 각각 덱을 재는 시험이다」로 불린다. 설계 분석은 이걸 **강제 사건(forcing event)** 이라 부른다 — 초반 전략을 무너뜨려 이후 결정에 파급을 만드는 조우 하나.

### 다키스트 던전 2 · 토큰 규칙

우리 토큰과 결정적으로 다른 셋:

1. **상쇄 쌍** — 힘↔약화, 방어↔취약, 회피↔실명, 속도↔현기증, 은신↔도발. **한쪽을 걸면 반대쪽이 사라진다.** 토큰이 목록이 아니라 계(系)가 되는 지점이다
2. **지속과 상한** — 소모되지 않으면 3턴 뒤 만료, 스택 상한 2~3
3. **`Guarded`(보호) / `Taunt`(도발)** — 대상 지정을 강제로 바꾼다. 「누구를 때릴지」가 플레이어 마음대로가 아니게 되는 유일한 장치

적도 이걸 쓴다. `Mongrel`은 아군에게 보호를 주고 자신은 반격·회피를 얻고, `Woodsman`은 자신에게 방어·아군에게 보호 2개, `Artifact Collector`는 살아 있는 동안 **전 적군에게** 치명률·속도·저항을 준다.

---

## 엔진 변경

### 1 · `EnemyAction`에 대상과 회복

```ts
export type EnemyAction = {
  damage?: number; block?: number; token?: TokenName; stacks?: number;
  heal?: number;
  target?: "player" | "self" | "ally" | "all_allies";   // 기본 player
};
```

`endTurn`(`core/combat.ts:85`)에서 `ally`는 살아 있는 다른 적 하나(자신 제외, 없으면 불발), `all_allies`는 전부. StS의 「아군 지원」과 DD2의 `Artifact Collector`가 같은 자리다.

### 2 · 패시브

`EnemyDefinition`에 `passives?: Passive[]`. **여덟 종**, 각각 훅 하나:

| 패시브 | 효과 | 훅 |
|---|---|---|
| `guard` | 아군이 받을 피해를 대신 받는다 (스택마다 1회) | `executeCard`의 `dealDamage` 호출부 |
| `shell: X` | 한 턴에 X 넘게 체력을 잃지 않는다 | `dealDamage` + `EnemyState.lostThisTurn` |
| `ward: X` | 해로운 토큰 X개를 무효화한다 | `addToken` |
| `curl: X` | 이번 전투 처음 맞을 때 방어 X | `dealDamage` + `EnemyState.hit` |
| `angry: X` | **맞을 때마다** `frenzy` X | `dealDamage` |
| `rally: X` | 아군이 죽으면 `frenzy` X | `updateOutcome` |
| `ramp: X` | 매 턴 `frenzy` X | `endTurn` |
| `spite: X` | 플레이어가 비공격 카드를 내면 `frenzy` X | `playCard` |

**`minion`(리더가 죽으면 이탈)은 뺐다.** `rally`와 배타라서 게이트 규칙 하나가 오직 그 충돌만 막으려고 존재하게 되고, 무엇보다 리더를 죽이면 전투가 **사라진다** — 결정을 늘리는 게 아니라 지운다. 「처치 순서」는 `rally`와 `support`가 이미 만든다.

`frenzy`를 힘 대신 쓴다 — **새 스탯을 만들지 않는다.** `dealDamage`가 이미 광란 +2를 소모한다(`core/rules.ts:67`). `ramp`·`rally`·`spite`가 전부 같은 토큰으로 흐르므로 화면도 이미 그릴 수 있다.

`guard`가 「센 카드로 한 놈만」의 직접 대응이고, `shell`은 그 카드의 상한이고, `curl`은 반대 극단(찔끔찔끔)의 대응이다. **셋이 같이 있어야 중간이 답이 된다.**

`curl`·`angry`·`rally`·`ward` 넷은 **반응형**이다 — 플레이어가 무엇을 했는지에 따라 되받아친다. [P-30](30-intervention.md)의 신의 개입이 위험해지는 이유가 전부 이 넷이다. 신은 묻지 않고 판을 흔들고, 앞에 `angry`가 서 있으면 그 도움이 적을 키운다. **개입에 페널티를 붙이지 않고 위험을 만드는 유일한 방법이다.**

#### 먼저 정할 판정 둘 — 안 정하면 두 번 구현한다

**1 · 반사는 「맞은 것」인가.** `deflect`는 피해를 0으로 만들고 공격자를 때린다(`core/rules.ts:61`). 이때 `curl`(처음 맞을 때)과 `angry`(맞을 때마다)가 발동하는가. **발동하지 않는다** — 둘 다 `dealDamage`가 실제로 `target.hp`를 깎은 뒤에만 센다. 반사는 대상이 피해를 받지 않은 것이고, 그렇게 두면 아테나 반사가 `angry` 적 앞에서 안전한 답이 된다. [P-31](31-powers.md)의 `thorns`도 같은 규칙을 탄다.

**2 · `shell`의 한 턴은 어디서 리셋되나.** 적에게는 턴 시작이 없다 — `startTurn`(`core/combat.ts:54`)은 플레이어 것만 올린다. `endTurn` 맨 끝, `shock`을 지우는 그 자리에서 `lostThisTurn`을 0으로 돌린다. **「한 턴」은 플레이어 턴 + 적 턴 한 바퀴다.**

### 3 · 토큰 진영과 상쇄

해로운 토큰 집합이 이미 코드에 있다. `selfTokens`(`core/rules.ts:146`) = `bulwark`·`deflect`·`crit`·`frenzy` — **이로운 넷과 정확히 같다.** 세 번째 목록을 만들지 말고 이것에서 파생시킨다.

```ts
export const harmfulTokens = tokenNames.filter((t) => !selfTokens.has(t));
// shock · displace · soaked · bleed · mark
```

`ward`가 이 집합을 읽고, P-26의 HUD 색도 같은 집합을 읽는다.

상쇄 쌍은 **하나만** 넣는다 — `frenzy`(+2) ↔ `soaked`(−1). 둘은 이미 `dealDamage`에서 정확히 반대 부호다. `addToken`에서 반대쪽이 있으면 서로 지운다, 세 줄이다. 사제가 광란을 벗겨내는 적이 되고, 아레스 덱이 사제를 먼저 죽일 이유가 생긴다.

**세 줄이지만 값이 바뀐다.** 상쇄가 붙으면 `soaked`는 완화(−1)에 더해 「적의 광란을 지운다」를 같이 한다 — `ramp`·`angry`·`rally`가 전부 광란으로 흐르므로 후반일수록 커진다. `tokenWeights.soaked`가 0.8이고 `mitigationTokens`에 들어 있어서(`tools/value.ts:21`) **포세이돈의 `pool_ratio`가 조용히 틀어진다.** 상쇄를 넣은 뒤 가중치를 다시 재고 이전 값과 사유를 리뷰에 남긴다.

### 4 · 스택 상한

DD2는 2~3으로 막는다. 우리는 무제한이다. `tokenLimits`를 `core/state.ts`에 두고 `addToken`에서 자른다.

**함정 — 요구와 부딪힌다.** `demand_artemis_mark`가 방금 "한 호흡에 여섯"(`tokens_applied_in_turn >= 6`)으로 바뀌었다. 이건 *부여 횟수*이지 *잔여 스택*이 아니므로 상한과 충돌하지 않는다. 확인만 하고 넘어간다 — 만약 관측이 잔여 스택을 세고 있으면 상한을 넣는 순간 지킴률이 0이 된다.

### 넣지 않는 것

- **소환·분열 — 1차에서만 뺀다.** 재생이 막는다고 썼던 건 **틀렸다**: `resolveTargets`는 배열 인덱스가 아니라 `enemy.id`로 대상을 찾는다(`core/targeting.ts:13`). 진짜 비용은 셋이다 — 소환체 id가 결정론적으로 유일해야 하고, `encounterThresholdFailure`의 조우 밴드가 고정 편성을 전제하며(소환사의 실효 세기는 상한이 없다), `enemyCounts` 관측이 조우당 하나의 수를 가정한다. `rally`로 「죽음이 판을 바꾼다」는 이미 얻으므로 밴드를 고친 뒤에 다시 본다
- **적 행동 선택(AI).** 패턴 cycle이 결정론적 재생의 뿌리다. StS의 슬라임도 "같은 행동 3연속 금지" 정도의 변주지 판단이 아니다 — 우리는 cycle 길이 2~4로 같은 리듬을 낸다
- **의도 은폐(`???`).** `intent_visible` 플래그가 이미 데이터에 있고 전부 `true`다. 켜는 건 밸런스 판정이 선 뒤

---

## 데이터 — 역할 8종

지역당 5~6종 + 보스. 역할마다 패시브와 패턴이 짝지어진다.

| 역할 | 패시브 | 패턴 골자 | 플레이어가 배우는 것 |
|---|---|---|---|
| `pressure` | `ramp 1` | 소딜 ×2 → 대딜 (cycle 3) | 빨리 끝내라 |
| `brute` | `angry 1` | 대딜 저빈도 (cycle 2) | 때릴수록 세진다 |
| `attrition` | `shell 12` | `block` + 저딜 (cycle 2) | 한 방으로는 못 뚫는다 |
| `applier` | — | `soaked`/`shock` 교대 | 사제를 먼저 죽여라 |
| `support` | — | `frenzy` → ally, `heal` → ally | **먼저 죽여야 하는 적** |
| `guardian` | `guard 2` | 자신에게 `bulwark`, 저딜 | 대상 선택이 막힌다 |
| `zealot` | `spite 1` | 저딜 고정 | 방어만 하면 진다 |
| `swarm` | `curl 6` | 저딜 다수 | 찔끔찔끔은 안 통한다 |
| 보스 | `ward 2` + 절반에서 `rally 2` | 앞 절반 방어, 뒤 절반 대딜 | 토큰만으로는 안 된다 |

한 조우에 패시브가 셋 이상 겹치지 않는다 — 겹치면 플레이어가 무엇 때문에 졌는지 못 읽는다.

진노 신 다섯(`tier: "god"`)은 [P-30](30-intervention.md)이 만든다. 여기서는 패시브만 준비하고 데이터는 비워 둔다 — 진노 도달률이 지금 **0.000**이라 만들어도 안 나온다.

**강제 사건 하나.** 지하 4층에 `zealot`+`guardian` 조우를 고정으로 둔다. 방어 일변도(`spite`)와 단일 타겟(`guard`)을 동시에 막는 조우다. 배치는 P-27이 하고, 여기서는 조우만 만든다.

---

## 게이트

### 1 · 조우 세기 환산이 틀린다

`tools/validate.ts:139` `encounterThresholdFailure`는 세기를 **`damage` op 평균**으로만 잰다. `support`의 아군 광란도, `ramp`의 누적도, `guard`의 실효 체력도 전부 0으로 잡힌다.

`intent()`와 `effectiveHp()`를 고친다:

- 토큰 환산은 `tools/value.ts`의 `tokenWeights`를 재사용한다. **두 번째 눈금을 만들지 않는다** — `dealDamage`의 보정(광란 +2, 감전 스택당 +1)과 같은 값이어야 하고, `core/rules.ts:66` 주석이 이미 그 계약을 적고 있다
- `guard`·`shell`·`curl`은 실효 체력에 더한다. `shell X`는 조우 예상 턴수(7~15) 안에서 상한으로 걸리는 만큼

### 2 · 패시브 어휘 커버리지 — 신규

**여덟 패시브가 각각 최소 하나의 적에게 붙어 있어야 한다.** 붙지 않은 패시브는 죽은 코드고, N-06에서 사문 셋(토큰 4종·헌신·진노 오라)을 되살린 것과 같은 부채가 된다.

`FailureKey`에 `passive_coverage` 하나 추가. 조우 단위가 아니라 데이터셋 단위 규칙이라 `pool_ratio`와 같은 자리다.

### 3 · 패배 맥락 관측 — 신규

지금 `RunResult`가 패배에 대해 갖는 것은 `hpCurve`뿐이다. 패시브 여덟을 넣고 승률이 내려가면 **「내려갔다」와 「`guard` 조우에서만 내려갔다」를 못 가른다** — 그리고 그 차이가 다음 수를 정한다.

```ts
// sim/report.ts · RunResult
defeatContext?: { region: string; floor: number; enemies: string[]; passives: string[] };
```

다섯 줄이고, 이 계획부터 뒤의 여섯 계획이 전부 쓴다. 리포트에 패시브별 패배 점유율 한 줄.

---

## 함정

- **`enemyDamageScale`을 만지지 않는다.** 난이도 다이얼로 편차를 닫으려던 시도는 전 구간 실패했다(N-04, N-06). 패시브가 승률을 떨어뜨리면 패시브 수치를 내린다
- **`guard`는 무한 루프를 만들 수 있다.** A가 B를 지키고 B가 A를 지키면 재지정이 순환한다. 재지정은 1회로 막는다
- **화면 둘을 여기서 떼어 온다.** [P-26](26-hud.md)은 맨 뒤로 갔다 — 나머지 다섯 계획이 화면을 계속 열기 때문이다. 다만 이 둘은 없으면 **대상 선택이 도박이 되어** 정책 행렬 자체가 뜻을 잃는다:
  - `ui/combat.tsx:34` `intentLabel`이 복합 행동을 `"대기"`로 뭉갠다 — 배열 반환으로 넓힌다
  - 적 이름 옆 패시브 배지 (`guard 2`·`shell 12`처럼 수치까지)

  둘 합쳐 서른 줄이다. 배치·색·우호도 미터는 P-26이 가져간다

---

## 세션 종료

- [ ] `--policy` 넷(`cardValue` 가중치 넷) + `--policy-matrix`, **변경 전 행렬**을 리뷰에 기록
- [ ] `EnemyAction.target`·`heal`, `endTurn` 아군 경로
- [ ] 패시브 8종 + 훅, 픽스처 `core/__fixtures__/broken/11-passive.json`
- [ ] 판정 둘: 반사는 `curl`·`angry`를 발동시키지 않는다 · `shell`은 `endTurn` 끝에서 리셋
- [ ] `harmfulTokens` 파생, `frenzy`↔`soaked` 상쇄, `tokenLimits`
- [ ] **`soaked` 가중치 재측정** — 상쇄가 붙으면 포세이돈 `pool_ratio`가 움직인다. 이전 값과 사유
- [ ] `demand_artemis_mark` 관측이 부여 횟수인지 확인 (잔여 스택이면 상한과 충돌)
- [ ] 게이트: `intent()`/`effectiveHp()` 환산 수정 + `passive_coverage`
- [ ] `RunResult.defeatContext` + 리포트에 패시브별 패배 점유율
- [ ] `intentLabel` 복합 반환 + 패시브 배지 (나머지 화면은 P-26)
- [ ] 지역당 적 5~6종, `npm run validate` 위반 0
- [ ] 2000런 정책 행렬 — 1위 독식 ≤ 50%, 조우당 격차 10%p. **독식이면 독식이라고 쓴다**
- [ ] `reports/round-7/ledger.md`에 2000런 스냅샷 한 줄
- [ ] `reviews/25-enemies.md` 작성 후 이 파일 삭제

---

## 참고

- [Slay the Spire Wiki · Intent](https://slaythespire.wiki.gg/wiki/Intent) — 의도 7종과 복합 의도
- [Slay the Spire Wiki · 적 전용 파워 데이터](https://slaythespire.wiki.gg/wiki/Module:Powers/StS2_data/Enemy) — 패시브 어휘 42종
- [Darkest Dungeon Wiki · Tokens](https://darkestdungeon.wiki.gg/wiki/Tokens) — 상쇄 쌍, 지속·상한, 보호/도발
- [Darkest Dungeon 2 · 던전 공통 계열 적](https://en.namu.wiki/w/%EB%8B%A4%ED%82%A4%EC%8A%A4%ED%8A%B8%20%EB%8D%98%EC%A0%84%202/%EC%A0%81/%EB%8D%98%EC%A0%84%20%EA%B3%B5%ED%86%B5%20%EA%B3%84%EC%97%B4%20%EC%A0%81) — 아군 버프·보호형 적 실례
- [Cloudfall Studios · Reverse Engineering Slay the Spire's Decisions](https://www.cloudfallstudios.com/blog/2020/11/2/game-design-tips-reverse-engineering-slay-the-spires-decisions) — 강제 사건, 상호 배타적 요구
- [Slay the Spire Wiki · Gremlin Nob](https://slay-the-spire.fandom.com/wiki/Gremlin_Nob) — 덱을 재는 정예

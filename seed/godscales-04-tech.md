# 신들의 저울 — 기술 설계

`godscales-04-tech.md` · 문서 세트: 01 시드 / 02 백로그 / 03 게임 규칙 / **04 기술 설계(현재)** / 05 준비물 · plans/

규칙의 *의미*는 03에 있고 여기에는 그 *형식*과 *허용 범위*가 있다.

---

## T-1. 스택

| 항목 | 결정 |
|---|---|
| 언어 | TypeScript (strict) |
| 런타임 | 브라우저 + Node (동일 `core/` 공유) |
| 빌드 | Vite |
| UI | React + `motion/react` |
| 시뮬 실행 | Node CLI — `npm run sim` |
| 파이프라인 실행 | Node CLI — `npm run validate` / `tune` |
| 콘텐츠 생성 | 구독 토큰 기반 세션. 출력은 `staging/`을 거쳐 게이트로 (A-6) |
| 배포 | 정적 호스팅. URL 하나로 즉시 플레이 |
| 검증 | JSON Schema (ajv) |

**LLM 호출은 `tools/` 아래 빌드타임 경로에만 둔다.** 빌드 산출물에 포함시키지 않는다.

### T-1.1 저장소와 반출

**localStorage · IndexedDB · 쿠키를 사용하지 않는다.**

**런 로그는 파일로 반출한다.** I-2에 의해 `seed + action[]`이면 런이 완전 복원된다.

```
런 종료 화면 → { seed, actions, replay_mode: "action_log" } JSON 다운로드
             → logs/human/ 에 넣는다
             → npm run sim --replay logs/human/*.json 이 집계에 합친다
```

---

## T-2. 디렉터리

```
core/            순수 로직 — 외부 의존 없음
  state.ts       상태 타입 (덱, 전투, 호의, 맵 진행)
  reducer.ts     (state, action) → state
  rng.ts         시드 기반 PRNG
  rules.ts       효과 DSL 해석
  favor.ts       호의 상수(초기값·단계 경계·감쇠·방치·요구 보상과 페널티),
                 판정, 단계별 전역 효과, 역린 개입, 은총 마일스톤
  fusion.ts      합성 조건 판정, 합성 카드 획득
  upgrade.ts     카드 업그레이드 균일 규칙
  targeting.ts   대상 해석 (self / enemy / all_enemies) + chain 파급
  demands.ts     요구 제시·판정, 상충 판정
  combat.ts      턴 진행, block 소멸, 더미 순환, 교착 상한
  map.ts         구역·층 구조 상수, 노드 진행
data/            게이트를 통과한 콘텐츠
  cards.json  enemies.json  gods.json  demands.json
staging/         생성 세션 출력이 게이트를 통과하기 전 머무는 곳
sim/             헤드리스 실행 — core만 참조
  runner.ts      1런 실행 → 로그
  bots/rule.ts   룰 기반 봇
  bots/llm.ts    LLM 에이전트 (전략 층)
  scenarios.ts   시작 상태 오버라이드
  replay.ts      action 로그 재생
  play.ts        CLI 플레이 모드
  report.ts      집계 (조합 행렬 포함)
logs/            human/ 반출 런 · generation/ 생성 세션 트랜스크립트
art/             icons/ · ui/ · cards/ · fx/
audio/           SFX
tools/           빌드타임 파이프라인 — 빌드 산출물에 포함시키지 않는다
  validate.ts  tune.ts  art.ts
prompts/         버전 관리되는 프롬프트
ui/              표현 층 — 읽기 전용
```

**의존 방향은 단방향이다.** `core/`는 아무것도 import하지 않는다.

**맵은 `core/map.ts`의 상수로 둔다.**

**대상 집합을 먼저 확정하고 효과를 적용한다.**

---

## T-3. 데이터 모델

### T-3.1 카드 스키마

```json
{
  "id": "card_zeus_chain_bolt",
  "name": "연쇄 벼락",
  "patron": "zeus",
  "cost": 1,
  "target": "enemy",
  "effects": [
    { "op": "damage", "value": 6 },
    { "op": "apply_token", "token": "shock", "stacks": 1 },
    { "op": "chain", "value": 3, "when": "favor(patron) >= 70" },
    { "op": "self_damage", "value": 2, "when": "favor(patron) < 30" }
  ],
  "tags": ["attack", "multi"]
}
```

합성 카드는 조합에 귀속한다(R-3.5).

```json
{
  "id": "card_fused_zeus_poseidon_deluge",
  "name": "범람하는 뇌우",
  "patron_pair": ["poseidon", "zeus"],
  "cost": 2,
  "target": "enemy",
  "effects": [
    { "op": "apply_token", "token": "soaked", "stacks": 1 },
    { "op": "damage", "value": 5 },
    { "op": "chain", "value": 4, "when": "has_token(target, soaked) >= 1" }
  ],
  "tags": ["attack", "fused", "multi"]
}
```

- `patron`과 `patron_pair` 중 **정확히 하나**를 갖는다 (I-4)
- `patron_pair`는 신 id를 사전순으로 정렬해 적는다
- 합성 카드의 `favor(patron)`은 **두 신 중 낮은 쪽**을 가리킨다
- `chain`은 `target: enemy` 카드에만 쓴다 (T-4)
- `target`은 `self` · `enemy` · `all_enemies` 중 하나로 고정한다 (R-6.2)
- `tags`는 닫힌 어휘다: `attack` `defend` `utility` `multi` `token` `favor` `exhaust`
- **카드 일러스트는 스키마가 아니라 `art/cards/{id}.webp` 파일 규약으로 연결한다** (A-2.3)

스키마에서 허용 op, 토큰 어휘, 수치 범위, 필수 필드, 태그 어휘를 닫는다.

### T-3.2 신 정의 스키마

```json
{
  "id": "zeus",
  "name": "제우스",
  "tokens": ["shock"],
  "ops": ["chain"],
  "rivals": ["poseidon"],
  "stage_effects": {
    "devotion": {
      "on_encounter_start": {
        "op": "apply_token", "token": "shock", "stacks": 1, "target": "all_enemies"
      }
    },
    "wrath": {
      "on_encounter_start": {
        "op": "apply_token", "token": "shock", "stacks": 2, "target": "self"
      }
    }
  },
  "demands": ["demand_zeus_overkill", "demand_zeus_multi"]
}
```

`ops`는 그 신에 귀속된 연산자다. 현재 `chain`(제우스)뿐이며 나머지 신은 빈 배열이다.

**검증 게이트는 `token`과 `op`가 해당 신의 `tokens` · `ops`에 속하는지 확인한다.** 전역 효과에도 적용한다.

#### 전역 상수는 `core/favor.ts`에 둔다

`favor_initial` · `favor_decay_per_encounter` · `favor_neglect_penalty` · 단계 경계 4개 · 요구 보상과 페널티 · 은총 마일스톤 · 업그레이드 +50%가 해당한다.

이 값들은 S-5의 가정치이자 T-6 ⑤의 전역 파라미터다. 자동 조정 대상에서 제외하고, 사람이 바꾸면 `human_intervened`와 `global_param_version`에 남긴다.

**`target`을 `all_enemies`와 `self` 사이에서 뒤집어 총애와 역린의 방향을 바꾼다.**

### T-3.3 적 스키마

```json
{
  "id": "enemy_shade_warden",
  "name": "망령 감시자",
  "region": "underworld",
  "tier": "normal",
  "role": "attrition",
  "hp": 46,
  "intent_visible": true,
  "pattern": [
    { "op": "damage", "value": 6 },
    { "op": "apply_token", "token": "soaked", "stacks": 2 },
    { "op": "damage", "value": 4, "repeat": 2 }
  ],
  "pattern_mode": "cycle",
  "groups": [
    { "id": "grp_warden_solo", "with": [] },
    { "id": "grp_warden_thralls", "with": ["enemy_bone_thrall", "enemy_bone_thrall"] }
  ]
}
```

- `tier`는 `normal` 또는 `boss`. 보스는 `groups` 없이 단독 조우로만 등장하며 별도 수치 범위를 적용받는다(T-6)
- `role`은 닫힌 어휘다: `pressure`(고피해 저HP) · `attrition`(저피해 고HP) · `applier`(토큰 부여) · `bulwark`(방어 보유)
- **`intent_visible`을 true로 고정한다.** 복수 적에서는 각 적의 의도를 개별 공개한다
- `pattern_mode`는 `cycle` 또는 `conditional`만 허용한다

### T-3.4 조우 구성

**적 스키마 안의 `groups` 필드로 정의한다.** `with: []`는 단독 조우다.

**게이트는 각 `group`의 총 HP와 총 의도 피해가 구역별 허용 범위(T-6) 안에 있는지 확인한다.** 조우 단위 임계값이 개체 단위보다 우선한다.

### T-3.5 신의 요구 스키마

```json
{
  "id": "demand_zeus_multi",
  "patron": "zeus",
  "condition": "hit_targets_in_turn >= 3",
  "axis": "target_spread",
  "polarity": "+",
  "min_enemies": 3
}
```

**보상 +12와 페널티 −18 / −9는 `core/favor.ts`의 전역 상수다.** 페널티 대상은 **나머지 후원 신**으로 런타임에 해석한다. 규칙은 R-5.1의 표다.

**`axis` + `polarity`가 상충 판정의 형식이다.** 같은 `axis`에 반대 `polarity`를 가진 두 요구를 동시 만족 불가능한 쌍으로 취급한다(R-5.2).

| `axis` | `+` | `−` |
|---|---|---|
| `target_spread` | 다중 대상 타격 | 단일 대상 집중 |
| `damage_taken` | 피해를 감수 | 무피해 유지 |
| `turn_economy` | 장기전 | 속결 |
| `token_load` | 토큰 다중 부여 | 토큰 없이 처리 |

검증 게이트는 (1) `axis`가 어휘에 있는지, (2) `polarity`가 `+`/`−`인지, (3) 같은 `axis`·반대 `polarity` 요구가 라이벌 신 쪽에 최소 1개 존재하는지 확인한다.

**라이벌이 없는 신의 요구는 조건 (3)을 면제한다.**

**`min_enemies`는 조건식의 달성 가능 최소 적 수다.** 조건식과 어긋난 요구는 반송한다.

**보스 조우에서는 `min_enemies <= 1`인 요구만 후보다.** 게이트는 각 신이 그런 요구를 최소 1개 갖는지 확인한다.

S-4의 3번으로 적 수를 1체로 축소할 경우 `min_enemies > 1`인 요구를 풀에서 제외한다.

---

## T-4. 효과 DSL

**공통 연산자**
`damage` `block` `draw` `energy` `heal` `self_damage` `apply_token` `favor_shift`

**귀속 연산자**

| 연산자 | 귀속 | 의미 |
|---|---|---|
| `chain` | zeus | 주 대상을 제외한 살아 있는 적 전원에게 `value`만큼 피해 |

`chain`은 `target: enemy` 카드에만 쓴다. 게이트가 검사한다.

**토큰 어휘** — 닫힌 집합. 의미와 지속 규칙은 R-4.1에 있다.

```
zeus       shock
poseidon   displace  soaked
athena     bulwark  deflect
ares       bleed  frenzy
artemis    mark  crit
```

토큰은 주인공과 적 양쪽에 부여한다.

**조건식** (`when`)
`favor(patron) >= n` · `favor(god) < n` · `has_token(target, t) >= n` · `turn > n` · `hp_pct(self) < n` · `deck_count(tag) >= n` · `enemy_count() >= n`

DSL은 파싱 가능하고 정적 분석 가능하게 유지한다. 파싱 불가는 검증 실패로 처리한다.

---

## T-5. 파이프라인 루프

```
① 스키마 · 토큰 어휘 · 임계값 정의
      ↓
② LLM 대량 생성  ←──────┐
      ↓                 │ 반송
③ 자동 검증 게이트 ──────┤
      ↓                 │
④ 헤드리스 시뮬          │
      ↓                 │
⑤ 리포트 → 자동 조정 ────┘
      ↓
   data/ 반영
```

---

## T-6. 단계별 계약과 밸런스 임계값

### ② LLM 대량 생성

- **신별로 나눠 생성한다.** 프롬프트에 해당 신의 토큰 어휘와 성향(R-4)만 노출한다
- 목표 수량의 5~10배를 과잉 생산한다
- 적은 `role`과 `region`을 지정해 요청한다
- 요구는 `axis`·`polarity`를 명시적으로 지정해 요청한다
- **합성 카드는 조합별로 생성한다.** 프롬프트가 두 신의 토큰 어휘를 동시에 노출한다. `pass_rate`를 조합별로 따로 기록한다
- 프롬프트는 `prompts/` 아래 파일로 관리하고 버전을 매긴다
- 생성 세션 트랜스크립트를 `logs/generation/`에 보관한다

### ③ 자동 검증 게이트

일곱 개의 필터를 통과해야 다음 단계로 간다.

| 필터 | `failure_breakdown` 키 | 판정 |
|---|---|---|
| 스키마 | `schema` | JSON Schema 위반, `patron`/`patron_pair` 동시 보유 또는 동시 누락, `target`·`tags`·`role` 열거형 이탈 |
| DSL 파싱 | `dsl_parse` | 효과식 파싱 실패, 미정의 op/토큰/조건 |
| 어휘 귀속 | `token_scope` | 소유 신에게 배정되지 않은 토큰 또는 연산자 사용 (`stage_effects` 포함), `target: enemy`가 아닌 카드의 `chain` |
| 합성 정합 | `fusion_scope` | `patron_pair` 정렬 위반, 두 신 외 어휘 사용, 한쪽 어휘만 사용, `exhaust` 태그 보유 |
| 요구 정합 | `demand_axis` | `axis` 어휘 이탈, 상충 쌍 부재(라이벌 없는 신은 면제), `condition`과 `min_enemies` 불일치, 신별 `min_enemies <= 1` 요구 부재 |
| 중복 | `duplicate` | op 시퀀스 + 수치 버킷 해시 일치, 또는 텍스트 코사인 유사도 0.85 이상 |
| 수치 이상 | `value_outlier` | 코스트당 기대값 또는 조우 임계값 이탈 |

### 코스트당 기대값

```
가치 v =  1.0 × damage
        + 1.0 × chain × (평균 적 수 − 1)
        + 0.8 × block
        + 2.5 × draw
        + 3.0 × energy
        + 0.7 × heal
        − 1.2 × self_damage
        + Σ (토큰 가중치 × stacks)

토큰 가중치   shock 1.0 · displace 2.5 · soaked 0.8
             bulwark 1.0 · deflect 2.0 · bleed 1.5 · frenzy 1.5
             mark 2.0 · crit 3.0

코스트당 기대값 = v / max(cost, 0.5)
허용 범위 = 4.0 ~ 8.0
```

보정 규칙.

- **조건부 효과**는 조건 발동률 추정치를 곱한다. 발동률은 ④의 시뮬 결과로 갱신한다
- **`all_enemies`**는 평균 적 수를 곱한다. 초기값 2.0이며 `enemy_count_dist` 실측으로 갱신한다
- **`exhaust` 태그**는 0.6을 곱한다
- **`favor(patron) >= 70` 조건**은 시뮬 기반 갱신을 적용한다
- **합성 카드의 허용 범위는 6.0 ~ 10.0이다**
- **업그레이드는 기대값 계산에서 제외한다.** 승률 영향은 `upgrade_rate`로 관측한다

토큰 가중치는 R-4.1의 지속 규칙을 전제로 한다. 지속 규칙 변경 시 이 표를 재산정한다.

`chain`의 파급 대상 수는 `평균 적 수 − 1`이며 초기값 1.0이다(`enemy_count_dist`로 갱신).

### 콘텐츠 분포 임계값

신별 풀에 아래 분포를 요구한다.

| 항목 | 목표 |
|---|---|
| 코스트 0 / 1 / 2 / 3 | 5% / 40% / 35% / 20% |
| `attack` / `defend` / `utility` | 40~50% / 20~30% / 25~35% |
| `exhaust` 비중 | 15% 이하 |
| 조건부 효과(`when`) 보유 비중 | **50% 이상** |

### 적과 조우 임계값

조우 단위 임계값이 개체 단위보다 우선한다.

| 항목 | 지하 | 지상 |
|---|---|---|
| 조우 총 HP (`HP + bulwark`) | 40~90 | 90~170 |
| 조우 총 의도 피해 / 턴 | 8~14 | 14~22 |
| 조우당 적 수 | 1~2 | 2~3 |
| 보스 HP | 130 | 190 |
| 보스 의도 피해 / 턴 | 12~16 | 18~24 |
| 목표 전투 길이 | 3~5턴 | 4~6턴 |
| 허용 손실 (전투) | 약 12 | 약 18 |
| 허용 손실 (보스) | 약 30 | 약 40 |

두 문서의 숫자가 어긋나면 R-8.3을 기준으로 한다.

**S-4의 3번을 실행할 때는 허용 손실을 전투 8 / 12, 보스 20 / 28로 내리고** 조우 총 HP와 의도 피해를 재산정한다.

### 승률 대역 — 분별력 조건

| 항목 | 대역 |
|---|---|
| 룰 봇 전체 승률 | 15~70% |
| 조합별 승률 표준편차 | 8%p 이하 |
| 라이벌 − 비라이벌 (룰 봇) | −5 ~ −15%p |
| 라이벌 − 비라이벌 (LLM 에이전트) | 룰 봇보다 좁혀질 것 |

**"사람에게 적절한 난이도인가"는 LLM 에이전트 런과 사람 플레이테스트로 판정한다.** 참고치 30~50%.

### ④ 시뮬 — 세 층의 플레이어

| 주체 | 런 수 | 답하는 질문 |
|---|---|---|
| 룰 봇 | 수천 | 콘텐츠가 내부적으로 일관된가. 이상치가 있는가 |
| LLM 에이전트 | 10~수십 | 판단이 필요한 상태에 도달할 수 있는가 |
| 사람 플레이테스트 | 수 | 이 게임이 사람에게 적절한가 |

**각 층은 자기 질문에만 답한다.** 사람 플레이테스트 런도 계측에 남긴다(T-9.3).

### 시나리오 시뮬

`sim/scenarios.ts`가 시작 상태를 오버라이드한다.

| 시나리오 | 주입 | 측정 대상 |
|---|---|---|
| `fused_deck` | 합성 카드를 시작 덱에 포함 | 합성 카드의 성능과 `pick_rate` |
| `grace_4` | 은총 4 달성 상태 | 마일스톤 효과의 승률 기여 |
| `grace_6` | 은총 6 달성 상태 | 코스트 감소의 승률 기여 |
| `wrath_entry` | 한 신을 호의 5로 시작 | 역린 개입의 강도 |
| `devotion_hold` | 한 신을 호의 90으로 고정 | 총애 전역 효과의 강도 |
| `both_devotion` | 두 신을 호의 75로 시작 | 합성 조건의 난이도 |

계측에 `scenario` 필드로 표시하고 **시나리오 런은 기본 승률 집계에서 제외한다.**

### 룰 봇 정책 정의

| 판단 | 정책 |
|---|---|
| 카드 사용 순서 | 기대 가치 내림차순. 가치 = 예상 피해 + 예상 방어 환산 + 토큰 기대 이득 |
| 대상 선택 | 이번 턴 처치 가능한 적 → 복수면 의도 피해량이 큰 적 → 없으면 최저 HP |
| 광역 판단 | 생존 적 2체 이상이면 `all_enemies` 기대 가치에 적 수를 곱해 비교 |
| 방어 판단 | 공개된 적 의도(T-3.3)를 합산해 그만큼만 block을 쌓는다 |
| 치사 대응 | 합산 피해가 현재 HP 이상이면 방어 최대화 |
| 역린 회피 | 호의 15 이하 신이 있으면 그 신 카드에 최대 가중치. 치사 대응보다 낮고 그 외 모든 판단보다 높다 |
| 호의 관리 | 노여움 진입 예상 시 해당 신 카드에 가중치 |
| 은총 경로 | 호의가 더 높은 신 하나를 총애로 유지한다 |
| 합성 시도 | 두 신이 우연히 70 이상이 되면 그 조우에서 양쪽 카드를 2장씩 쓰도록 순서만 조정 |
| 은총 마일스톤 선택 | 업그레이드·코스트 감소 대상은 코스트당 기대값 최상위 카드 |
| 상충 요구 선택 | (달성 확률 × 12) − 상대 신의 예상 하락 손실(−18 / −9). 상대를 역린으로 미는 선택지에 고정 감점 |
| 요구 수락 | 달성 시도 여부만 판단 |
| 층 경로 선택 (3·5층) | HP가 최대의 50% 미만이면 휴식 |
| 휴식 선택 | HP가 최대의 70% 미만이면 회복. 아니면 코스트당 기대값 최하위 카드 제거 |
| 보상 선택 | 현재 덱의 태그 분포에서 가장 부족한 축을 보완 |
| `exhaust` 취급 | 기대 가치에 0.6을 곱해 순서를 정한다 |
| 탐색 깊이 | 1턴 그리디 |

**정책 버전을 고정하고 기록한다.** 정책 변경 시 이전 회차 데이터를 폐기하고 처음부터 재수집하며 그 사실을 계측에 남긴다.

층 경로와 휴식 임계값(50%, 70%)은 정책의 일부다. 변경 시 정책 버전을 올린다.

### ⑤ 리포트 → 자동 조정

- 임계 이탈 카드의 수치를 자동 조정하고 재시뮬한다
- 3회 조정 후에도 이탈하면 폐기하고 ②에 재생성을 요청한다
- 회차별 승률 분산 추이를 보관한다
- **전역 파라미터는 자동 조정 대상에서 제외한다.** 사람이 명시적으로 변경하고 계측에 남긴다

조정 순서와 근거 주체.

| 순서 | 조정 대상 | 근거 |
|---|---|---|
| 1 | 임계값을 벗어난 적·조우 수치 | 룰 봇 |
| 2 | 카드 간 상대 델타 이상치 | 룰 봇 |
| 3 | 전역 파라미터 (HP 예산, 호의 변동량) | **LLM 에이전트와 사람 플레이테스트** |

룰 봇 승률이 분별 대역(15~70%)을 벗어나면 대역 안으로 되돌린다. 그 조정은 3번에 해당하므로 사람이 판단하고 계측에 남긴다.

---

## T-7. 조합 교락의 통제

1. **층화 시뮬** — 10개 조합에 런을 균등 배분한다
2. **조합 내 델타 측정** — 카드 승률 델타를 조합 내에서 계산한 뒤 조합 간 평균을 낸다
3. **조정 대상 분리** — 특정 조합에서만 이탈하는 카드는 조합 상호작용 문제로 분류하고 자동 조정에서 제외한 뒤 `pairing_flagged`로 보고한다
4. **기준선 활용** — 아르테미스 포함 조합을 대조군으로 둔다

---

## T-8. LLM 에이전트 루프

플레이테스트 에이전트는 사람 플레이어와 동일한 정보 범위를 사용한다.

```
관측         현재 상태를 사람이 보는 정보 범위로 직렬화
             (호의 수치와 단계, 적별 의도, 제시된 요구, 남은 층 포함)
컨텍스트 압축   요약 + 최근 N턴
판단         가능한 action 목록 중 선택 + 선택 이유
행동         core에 dispatch
폴백         파싱 실패·무효 action·타임아웃 → 룰 봇 판단으로 대체, 실패 카운트 기록
```

**에이전트는 전략 층만 판단하고 전투 조작은 룰 봇에게 맡긴다.** 판단 지점은 신 조합 선택, 조우 진입 전략, 상충 요구, 층 경로, 휴식, 보상, 은총 마일스톤이다. 카드 사용 순서와 대상 선택은 룰 봇 정책이 처리한다.

**리포트에 이 분담을 명시한다** — 전투 층의 체감은 사람 플레이테스트가, 전략 층의 도달 가능성은 에이전트가 답한다.

**선택 이유를 로그에 남긴다.** 상충 요구에서 어느 쪽을 왜 택했는지, 역린이 회복 불가능하게 느껴진 시점이 있었는지, 휴식과 전투 사이 선택이 실제로 고민이었는지를 기록한다.

---

## T-9. 계측

### T-9.1 로그 스키마

```
generation
  attempts              생성 시도 수
  passed                통과 수
  pass_rate             통과율
  failure_breakdown     { schema, dsl_parse, token_scope, fusion_scope,
                          demand_axis, duplicate, value_outlier }
                        게이트 필터 일곱 개와 1:1 대응한다 (T-6 ③)
  by_patron             신별 통과율
  by_kind               { card, fused_card, enemy, demand } 종류별 통과율
  by_pairing            합성 카드 조합별 통과율
  distribution_check    코스트·태그 분포가 목표에서 벗어난 정도
  prompt_version        프롬프트 버전별 통과율

simulation
  total_runs            총 런 수
  bot_policy_version    룰 봇 정책 버전
  global_param_version  전역 파라미터 버전
  replay_mode           seed_only | action_log  (I-2 경계)
  runs_by_actor         { rule_bot, llm_agent, human }
  scenario              null | fused_deck | grace_4 | grace_6 | wrath_entry
                        | devotion_hold | both_devotion — 기본 집계에서 제외
  runs_by_pairing       조합별 런 수 (층화 확인용)
  win_rate_matrix       신 조합 5×5 승률 행렬
  card_win_delta        조합 내 델타의 조합 간 평균
  pick_rate             카드별 선택률
  favor_curve           런 중 호의 추이 (신별)
  favor_floor           런 중 신별 최저 호의
  devotion_ratio        총애 단계에서 보낸 턴 비율
  anger_ratio           노여움 단계에서 보낸 턴 비율
  wrath_ratio           역린 단계에서 보낸 턴 비율
  wrath_encounters      역린 개입이 발생한 조우 수 및 신별 분포
  wrath_recovery        역린 진입 후 평온 이상으로 복귀한 비율
  conflict_outcomes     상충 요구에서 어느 신을 택했는지 분포
  conflict_penalty_dist 요구 페널티 적용 분포 { rival_18, non_rival_9, none }
  grace_earned          조합별·신별 은총 획득량
  grace_milestones      2 / 4 / 6 도달 비율
  fusion_rate           조합별 합성 카드 획득률
  fusion_encounter      합성이 성립한 조우 순번 분포
  upgrade_rate          업그레이드된 카드 수와 대상 분포
  hp_curve              층별 HP 추이
  region_clear_rate     구역별 도달·클리어 비율
  rest_choices          휴식 노드에서 회복 vs 제거 선택 분포
  path_choices          3·5층에서 전투 vs 휴식 선택 분포
  block_efficiency      막은 피해 / 쌓은 block
  condition_trigger     조건부 효과 실제 발동률
  token_interaction     토큰 조합 발생 빈도
  exhaust_usage         exhaust 카드 사용률
  enemy_count_dist      조우당 적 수 분포
  target_spread         단일 대상 vs 광역 카드 사용 비율
  run_length            런 길이 분포 (턴 수, 실시간 추정)
  timeout_rate          50턴 교착으로 종료된 조우 비율 (R-11)
  agent_fallbacks       LLM 에이전트 폴백 수 및 사유

tuning
  loop_iteration        루프 회차
  variance_before/after 회차별 승률 분산
  auto_adjusted         자동 조정 카드 수
  enemy_adjusted        자동 조정 적·조우 수
  pairing_flagged       조합 상호작용으로 분류된 카드 수
  discarded             폐기 수
  human_intervened      사람 개입 수 + 개입 사유

process
  time_split            파이프라인 : 게임 구현 : 튜닝
  ai_failures           AI 실패 사례 { 종류, 증상, 대응 }
```

### T-9.2 주요 지표

| 지표 | 읽는 법 |
|---|---|
| 신 조합 승률 행렬 | 5×5 히트맵. **칸 사이의 차이**를 읽는다. 라이벌 − 비라이벌 격차가 T-6 대역 안인지 확인 |
| 두 봇의 조합 격차 차이 | 라이벌 조합의 불리함이 두 주체에서 다르게 나타나는지 |
| 은총과 합성의 조합별 순서 | `grace_earned`는 라이벌 > 비라이벌 > 대조군, `fusion_rate`는 역순 (R-3.6) |
| 주체별 `fusion_rate` 차이 | 두 주체에서 비슷하면 합성 조건을 조인다 |
| 시나리오 런과 기본 런의 대비 | `fused_deck`과 기본 런의 승률 차이가 합성 카드의 순수 기여 |
| 호의 곡선 | 평탄하면 R-3을 다시 설계한다 |
| 역린 체류 비율과 복귀율 | `wrath_recovery`가 0에 가까우면 R-3.3의 상승량을 올린다 |
| HP 곡선과 구역 도달률 | 지상 클리어율이 5% 미만이면 전역 파라미터를 고친다 |
| 휴식·경로 선택 분포 | 한쪽으로 치우치면 R-8.2의 선택을 재설계한다 |
| 상충 요구 선택 분포 | 치우치면 두 축의 요구 난이도를 맞춘다 |
| 방어 효율 | `block_efficiency`가 1에 가까우면 봇이 의도를 정확히 읽고 있다 |
| 대상 사용 분포 | `target_spread`가 치우치면 환산 계수와 적 수 분포를 조정한다 |
| `conflict_penalty_dist` | 아르테미스 조합에서 `none`이 아니면 R-5.1 구현을 고친다 |

### T-9.3 정직성 요건

**`human_intervened`와 `ai_failures`를 채운다.** 어디서 AI가 틀렸고 어디서 사람이 들어갔는지 기록한다.

전역 파라미터 조정을 전부 `human_intervened`에 남긴다(T-6 ⑤).

**사람 플레이테스트 런을 남긴다.** 전역 파라미터 조정의 근거다.

**세션마다 그때그때 적는다.**

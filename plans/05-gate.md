# P-05 · 검증 게이트

`plans/05-gate.md` · [◀ P-04](04-runner.md) · [색인](00-index.md) · [P-06 ▶](06-generator.md)

**크기** 김 · **착수 조건** P-02 (기대값 공식이 토큰 지속 규칙에 의존한다)

---

## 완료 정의

의도적으로 망가뜨린 픽스처 7종이 각각 해당 `failure_breakdown` 키로 반송되고, 정상 픽스처는 전량 통과한다.

| 망가뜨린 것 | 기대 반송 키 |
|---|---|
| `patron`과 `patron_pair` 동시 보유 | `schema` |
| 미정의 op `teleport` | `dsl_parse` |
| 제우스 카드에 `bleed` 부여 | `token_scope` |
| `target: all_enemies` 카드에 `chain` | `token_scope` |
| 합성 카드가 한쪽 신 어휘만 사용 | `fusion_scope` |
| 아레스 요구에 상충 쌍 없음 | `demand_axis` |
| 기존 카드와 op 시퀀스 · 수치 버킷 일치 | `duplicate` |
| 코스트 1에 피해 20 | `value_outlier` |

```bash
npm run validate -- core/__fixtures__/broken/
npm test -- gate
```

---

## 산출

```
tools/validate.ts             7개 필터
tools/schema/card.json        ajv 스키마 (엄격)
tools/schema/enemy.json
tools/schema/demand.json
tools/schema/god.json
tools/value.ts                코스트당 기대값 공식
core/__fixtures__/broken/     필터당 1개씩, 8건
test/gate.test.ts
```

---

## 구현 노트

**이 세션의 테스트가 곧 `failure_breakdown`의 정의다.** 필터와 키가 1:1로 대응한다는 것을 여기서 코드로 고정하지 않으면, 나중에 통과율 리포트의 항목이 무엇을 세는지 아무도 모르게 된다. T-6의 필터 표에 `failure_breakdown` 키 열이 이미 있다.

**기대값 공식**(T-6) — 토큰 가중치는 P-02의 지속 규칙을 전제로 한 값이다. 지속 규칙을 바꾸면 이 표 전체가 무효가 된다.

```
가치 v = 1.0×damage + 1.0×chain×(평균 적 수 − 1) + 0.8×block
       + 2.5×draw + 3.0×energy + 0.7×heal − 1.2×self_damage
       + Σ(토큰 가중치 × stacks)
코스트당 기대값 = v / max(cost, 0.5)
허용 범위 = 4.0 ~ 8.0   (합성 카드는 6.0 ~ 10.0)
```

보정 규칙 넷 — 조건부 효과는 발동률 추정치를 곱하고, `all_enemies`는 평균 적 수(초기 2.0)를 곱하고, `exhaust`는 0.6을 곱하고, 업그레이드는 계산에 넣지 않는다.

**요구 정합 필터의 예외**(T-3.5) — 라이벌이 없는 신(아르테미스)의 요구는 상충 쌍 검사를 면제한다. 면제하지 않으면 아르테미스 요구가 전량 반송되어 R-9의 신당 3~4종을 채울 수 없다. 그리고 각 신이 `min_enemies <= 1` 요구를 최소 1개 갖는지 확인한다 — 없으면 그 신의 보스 요구 풀이 빈다.

**구조화 출력이 이 게이트를 대체하지 않는다**(A-6.3). `minimum`/`maximum`/배열 길이/`oneOf`를 지원하지 않으므로 값 범위는 여전히 ajv가 잡는다.

**참조** — T-6 ③ (필터 표), T-6 (기대값 공식), T-3.1~T-3.5 (스키마), T-9.1 (`failure_breakdown`)

---

## 세션 종료

- [ ] 7종 반송이 각 키로 정확히 분류
- [ ] 정상 픽스처 전량 통과
- [ ] 커밋

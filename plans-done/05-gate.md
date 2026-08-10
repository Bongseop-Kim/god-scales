# P-05 · 검증 게이트

`plans/05-gate.md` · [◀ P-04](04-runner.md) · [색인](00-index.md) · [P-06 ▶](06-generator.md)

**크기** 김 · **착수 조건** P-02

---

## 완료 정의

망가뜨린 픽스처 8건이 각각 해당 `failure_breakdown` 키로 반송되고, 정상 픽스처는 전량 통과한다.

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
tools/validate.ts             7개 필터 + --apply
tools/schema/card.json        ajv 스키마 (엄격)
tools/schema/enemy.json
tools/schema/demand.json
tools/schema/god.json
tools/value.ts                코스트당 기대값 공식
core/__fixtures__/broken/     필터당 1개씩, 8건
test/gate.test.ts
```

---

## 기대값 공식

```
가치 v = 1.0×damage + 1.0×chain×(평균 적 수 − 1) + 0.8×block
       + 2.5×draw + 3.0×energy + 0.7×heal − 1.2×self_damage
       + Σ(토큰 가중치 × stacks)

토큰 가중치  shock 1.0 · displace 2.5 · soaked 0.8 · bulwark 1.0
            deflect 2.0 · bleed 1.5 · frenzy 1.5 · mark 2.0 · crit 3.0

코스트당 기대값 = v / max(cost, 0.5)
허용 범위 = 4.0 ~ 8.0   (합성 카드는 6.0 ~ 10.0)
```

보정 — 조건부 효과는 발동률 추정치를, `all_enemies`는 평균 적 수(초기 2.0)를, `exhaust`는 0.6을 곱한다. 업그레이드는 계산에서 제외한다.

---

## 지시

- **필터와 `failure_breakdown` 키를 1:1로 대응시킨다**(T-6 ③, T-9.1)
- 요구 정합 필터에서 **라이벌이 없는 신의 요구는 상충 쌍 검사를 면제한다**(T-3.5)
- 각 신이 `min_enemies <= 1` 요구를 최소 1개 갖는지 확인한다
- `--apply` 옵션으로 통과분만 `data/`에 반영한다

**참조** — T-6 ③, T-3.1~T-3.5, T-9.1

---

## 세션 종료

- [ ] 8종 반송이 각 키로 정확히 분류
- [ ] 정상 픽스처 전량 통과
- [ ] 커밋

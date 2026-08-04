# P-08 · 요구와 페널티

`plans/08-demands.md` · [◀ P-07](07-favor.md) · [색인](00-index.md) · [P-09 ▶](09-map.md)

**크기** 보통 · **착수 조건** P-07

---

## 완료 정의

10개 조합을 100런씩 돌렸을 때 `conflict_penalty_dist`가 R-5.1 표와 일치한다.

| 조합 | 개수 | 기대 |
|---|---|---|
| 라이벌 (제우스↔포세이돈, 아테나↔아레스) | 2 | `rival_18`만 발생 |
| 비라이벌 | 4 | `non_rival_9`만 발생 |
| **아르테미스 포함** | 4 | **`none`만 발생** |

```bash
npm run sim -- --runs 1000 --stratified
```

---

## 산출

```
core/demands.ts       요구 제시 · 판정 · 상충 판정 · 페널티 대상 해석
core/favor.ts         보상 +12, 페널티 −18/−9/없음 상수
prompts/demand-v1.md
data/demands.json
sim/report.ts         conflict_outcomes · conflict_penalty_dist
```

---

## 지시

- **페널티 대상을 관계로 런타임 해석한다**(R-5.1). 요구 스키마에 `reward`/`penalty` 필드를 두지 않는다(T-3.5)
- 값은 전역 상수로 둔다
- 상충 요구는 라이벌 조합 전용이며 만족시킨 요구의 페널티(−18)를 적용한다. 실패 자체에 별도 페널티를 두지 않는다
- 축 어휘는 닫힌 집합 4종: `target_spread` `damage_taken` `turn_economy` `token_load`

## 봇 정책 추가

| 판단 | 정책 |
|---|---|
| 상충 요구 선택 | (달성 확률 × 12) − 상대 신의 예상 하락 손실(−18 / −9). 상대를 역린으로 미는 선택지에 고정 감점 |
| 요구 수락 | 달성 시도 여부만 판단 |
| 호의 관리 | 노여움 진입 예상 시 해당 신 카드에 가중치 |
| 역린 회피 | 호의 15 이하 신이 있으면 그 신 카드에 최대 가중치. 치사 대응보다 낮고 그 외 모든 판단보다 높다 |

**참조** — R-5.1, R-5.2, R-3.3, T-3.5

---

## 세션 종료

- [ ] `conflict_penalty_dist`가 세 구간 모두 표와 일치
- [ ] 아르테미스 조합에서 `none`만 발생
- [ ] `prompts/demand-v1.md` 커밋
- [ ] 커밋

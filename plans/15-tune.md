# P-15 · 자동 조정 루프

`plans/15-tune.md` · [◀ P-14](14-matrix.md) · [색인](00-index.md) · [P-16 ▶](16-agent.md)

**크기** 보통 · **착수 조건** P-14

---

## 완료 정의

1회차가 전체 완주하고 아래가 기록된다.

```
tuning
  loop_iteration         1
  variance_before/after  회차 전후 승률 분산
  auto_adjusted          자동 조정된 카드 수
  enemy_adjusted         자동 조정된 적·조우 수
  pairing_flagged        조합 상호작용으로 분류된 카드 수
  discarded              3회 조정 후에도 이탈해 폐기된 수
  human_intervened       사람 개입 수 + 개입 사유
```

**`human_intervened`가 비어 있지 않다**(T-9.3).

```bash
npm run tune -- --iteration 1
```

---

## 산출

```
tools/tune.ts       임계 이탈 자동 조정 → 재시뮬 → 3회 후 폐기 → ②에 재생성 요청
reports/round-1/    1회차 전체 기록
```

---

## 루프

```
① 스키마 · 어휘 · 임계값 정의
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

## 조정 순서 (T-6 ⑤)

| 순서 | 조정 대상 | 근거 |
|---|---|---|
| 1 | 임계값을 벗어난 적·조우 수치 | 룰 봇 |
| 2 | 카드 간 상대 델타 이상치 | 룰 봇 |
| 3 | 전역 파라미터 | **P-13에서 동결. 자동 조정에서 제외** |

---

## 지시

- 임계 이탈 카드의 수치를 자동 조정하고 재시뮬한다
- **3회 조정 후에도 이탈하면 폐기하고 ②에 재생성을 요청한다**
- 특정 조합에서만 이탈하는 카드는 `pairing_flagged`로 분류한다(T-7)
- 조건 발동률 추정치를 시뮬 결과로 갱신한다
- `enemy_count_dist` 실측으로 `all_enemies` 평균 적 수 계수를 갱신한다
- **`human_intervened`와 `ai_failures`를 그때그때 적는다**(T-9.3)

**참조** — T-5, T-6 ⑤, T-7, T-9.1 `tuning`, T-9.3

---

## 세션 종료

- [ ] 1회차 완주
- [ ] `variance_before/after` 기록
- [ ] `human_intervened` 비어 있지 않음
- [ ] `reports/round-1/` 커밋

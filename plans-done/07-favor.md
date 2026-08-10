# P-07 · 호의와 단계

`plans/07-favor.md` · [◀ P-06](06-generator.md) · [색인](00-index.md) · [P-08 ▶](08-demands.md)

**크기** 보통 · **착수 조건** P-06

---

## 완료 정의

호의 시나리오 테스트가 통과하고 리포트에 `favor_curve`가 나온다.

| 케이스 | 기대 |
|---|---|
| 그 신의 카드 사용 | +1, 조우당 상한 +5 |
| 조우 종료 | −3 |
| 그 신 카드를 한 조우 동안 미사용 | 추가 −2 |
| 100에서 +1 / 0에서 −1 | 클램프, 초과분 소멸 |
| 호의 70 진입 후 다음 조우 시작 | 그 신의 권능이 **적에게** 붙는다 |
| 호의 9 이하 진입 후 다음 조우 시작 | 그 신의 권능이 **주인공에게** 붙는다 |
| 단계 경계 4개 | `core/favor.ts` 상수. `gods.json`에 없다 |

```bash
npm test -- favor
npm run sim -- --runs 200
```

---

## 산출

```
core/favor.ts     상수(초기값 50, 경계 70/30/10, 감쇠 −3, 방치 −2),
                  4단계 판정, 변동 적용, 클램프, 단계별 전역 효과
core/rules.ts     favor() 조건식 실장
sim/report.ts     favor_curve · devotion_ratio · anger_ratio · wrath_ratio · favor_floor
test/favor.test.ts
```

---

## 지시

- `favor_initial` · `favor_decay_per_encounter` · `favor_neglect_penalty` · 단계 경계를 **`core/favor.ts` 상수로 둔다**(T-3.2)
- `stage_effects`의 `target`을 `all_enemies`와 `self` 사이에서 뒤집어 총애/역린 방향을 만든다
- 방치 페널티는 전투 조우에만 적용한다
- 게이트가 `stage_effects`의 토큰 귀속을 검사하게 한다

**참조** — R-3.1~R-3.3, T-3.2

---

## 세션 종료

- [ ] `npm test -- favor` 통과
- [ ] `favor_curve`가 리포트에 나옴
- [ ] 커밋

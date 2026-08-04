# P-07 · 호의와 단계

`plans/07-favor.md` · [◀ P-06](06-generator.md) · [색인](00-index.md) · [P-08 ▶](08-demands.md)

**크기** 보통 · **착수 조건** P-06 (조건부 카드가 생성되어 있어야 조건식이 의미를 갖는다)

---

## 완료 정의

호의 시나리오 테스트가 통과하고, `npm run sim`의 리포트에 `favor_curve`가 나온다.

| 케이스 | 기대 |
|---|---|
| 그 신의 카드 사용 | +1, 조우당 상한 +5 |
| 조우 종료 | −3 |
| 그 신 카드를 한 조우 동안 미사용 | 추가 −2 |
| 100에서 +1 / 0에서 −1 | 클램프, 초과분 소멸 |
| 호의 70 진입 후 다음 조우 시작 | 그 신의 권능이 **적에게** 붙는다 |
| 호의 9 이하 진입 후 다음 조우 시작 | 그 신의 권능이 **주인공에게** 붙는다 |
| 단계 경계 위치 | `core/favor.ts` 상수. `gods.json`에 없다 |

```bash
npm test -- favor
npm run sim -- --runs 200   # favor_curve 출력 확인
```

---

## 산출

```
core/favor.ts     상수 (초기값 50, 경계 70/30/10, 감쇠 −3, 방치 −2), 4단계 판정,
                  변동 적용, 클램프, 단계별 전역 효과
core/rules.ts     favor() 조건식 실장
sim/report.ts     favor_curve · devotion_ratio · anger_ratio · wrath_ratio · favor_floor
test/favor.test.ts
```

---

## 구현 노트

**전역 상수는 `gods.json`에 두지 않는다**(T-3.2). `favor_initial` `favor_decay_per_encounter` `favor_neglect_penalty` 단계 경계는 전부 `core/favor.ts`의 상수다. 신별 데이터로 두면 생성 단계에서 제우스만 `favor_initial: 55`인 파일이 나오고, 스키마상 유효하므로 게이트가 잡지 못하며 조합별 승률 비교가 오염된다.

**총애와 역린은 같은 권능의 방향만 다르다**(R-3.1). `stage_effects`의 `target`을 `all_enemies`와 `self` 사이에서 뒤집으면 방향이 바뀐다. 새 연산자도 새 토큰도 필요 없으므로 통과율에 영향이 없다.

**아레스만 총애와 역린의 부여 대상이 같다** — `frenzy`가 이득과 손실을 동시에 갖는 토큰이므로 총애에서는 감수할 만하고 역린에서는 방어 봉쇄가 얹혀 감수할 수 없게 된다.

**어휘 귀속은 전역 효과에도 적용된다**(T-3.2). 게이트가 `stage_effects`의 토큰이 그 신의 `tokens`에 속하는지 확인한다.

**참조** — R-3.1 (단계와 전역 효과), R-3.2 (역린의 성질), R-3.3 (변동량), T-3.2 (신 스키마)

---

## 세션 종료

- [ ] `npm test -- favor` 통과
- [ ] `favor_curve`가 리포트에 나옴
- [ ] 커밋

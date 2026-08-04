# P-02 · 효과 DSL과 토큰

`plans/02-dsl.md` · [◀ P-01](01-repo.md) · [색인](00-index.md) · [P-03 ▶](03-combat.md)

**크기** 김 · **착수 조건** P-01

---

## 완료 정의

DSL 픽스처 테이블 테스트가 통과한다. 최소 케이스 전부:

**공통 연산자 8종** — 각 1건
`damage` `block` `draw` `energy` `heal` `self_damage` `apply_token` `favor_shift`

**토큰 지속 규칙 9종** — R-4.1의 지속 열 각 1건

| 케이스 | 기대 |
|---|---|
| `bleed` 3스택 | 소멸까지 총 6 피해 (3 → 2 → 1) |
| `deflect` 1스택 | 피해 1회를 되돌리고 소멸 |
| `bulwark` 5에 피해 3 | 3 흡수, `bulwark` 2로 감소 |
| `crit` 1스택 | 1회 발동 후 소멸 |
| `displace` 1스택 | 그 턴 적이 행동하지 않고 **패턴 인덱스도 진행하지 않는다** |
| `shock` `soaked` `frenzy` `mark` | 조우 내내 유지, 소모 없음 |
| 조우 종료 | 모든 토큰 소멸 (R-7.4) |

**`chain` 연산자**

| 케이스 | 기대 |
|---|---|
| 적 3체, `target: enemy`, `chain 4` | 주 대상 제외 2체에만 4 피해 |
| 적 1체 | 파급 대상 없음, 오류 아님 |
| `target: all_enemies` 카드에 `chain` | **실행이 아니라 로드 시점에 거부** (T-4) |

**조건식 7종** — 참/거짓 양쪽에서 평가
`favor(patron) >= n` · `favor(god) < n` · `has_token(target, t) >= n` · `turn > n` · `hp_pct(self) < n` · `deck_count(tag) >= n` · `enemy_count() >= n`

```bash
npm test -- dsl
```

---

## 산출

```
core/rules.ts             op 실행, 조건식 평가
core/targeting.ts         대상 해석 (self / enemy / all_enemies) + chain 파급
core/state.ts             토큰 상태 자료구조 (주인공 · 적별)
core/__fixtures__/cards.ts    테스트용 카드 (data/ 아님)
test/dsl.test.ts          위 테이블
```

---

## 구현 노트

**이 세션이 T-6 기대값 공식의 전제다.** 지속 규칙이 여기서 틀리면 코스트당 기대값이 틀리고, 게이트(P-05)가 잘못된 기준으로 반송한다. 가장 긴 세션인 이유는 케이스 수 때문이지 난이도 때문이 아니다.

**`targeting.ts`를 분리하는 이유**(T-2) — 대상 해석이 효과 적용과 섞이면 `all_enemies` 처리와 `chain` 파급이 같은 코드에 뭉친다. **대상 집합을 먼저 확정하고 그 다음 효과를 적용한다.**

**`displace`의 패턴 인덱스가 함정이다.** 인덱스를 진행시키면 공개된 의도(T-3.3)와 실제 행동이 어긋나고, 의도 합산에 의존하는 룰 봇의 방어 정책(P-04)이 성립하지 않는다. 지연된 행동이 다음 턴에 그대로 나온다.

**`chain`은 토큰이 아니라 제우스 귀속 연산자다**(R-4.1, T-4). 파급은 상태가 아니라 그 자리에서 끝나는 효과이므로 스택으로 들고 있을 것이 없다. `target: enemy` 전용 검사는 여기서 하고, 게이트에서도 `token_scope` 필터로 다시 잡는다(T-6).

**참조** — R-4.1 (토큰 의미와 지속), T-4 (DSL 어휘), R-7.4 (토큰 상태)

---

## 세션 종료

- [ ] `npm test -- dsl` 통과
- [ ] 순수성 테스트 여전히 통과
- [ ] 커밋

# P-02 · 효과 DSL과 토큰

`plans/02-dsl.md` · [◀ P-01](01-repo.md) · [색인](00-index.md) · [P-03 ▶](03-combat.md)

**크기** 김 · **착수 조건** P-01

---

## 완료 정의

DSL 픽스처 테이블 테스트가 통과한다.

**공통 연산자 8종** — 각 1건
`damage` `block` `draw` `energy` `heal` `self_damage` `apply_token` `favor_shift`

**토큰 지속 규칙** — R-4.1의 지속 열

| 케이스 | 기대 |
|---|---|
| `bleed` 3스택 | 소멸까지 총 6 피해 (3 → 2 → 1) |
| `deflect` 1스택 | 피해 1회를 되돌리고 소멸 |
| `bulwark` 5에 피해 3 | 3 흡수, `bulwark` 2로 감소 |
| `crit` 1스택 | 1회 발동 후 소멸 |
| `displace` 1스택 | 그 턴 적이 행동하지 않고 **패턴 인덱스도 진행하지 않는다** |
| `shock` `soaked` `frenzy` `mark` | 조우 내내 유지 |
| 조우 종료 | 모든 토큰 소멸 |

**`chain` 연산자**

| 케이스 | 기대 |
|---|---|
| 적 3체, `target: enemy`, `chain 4` | 주 대상 제외 2체에만 4 피해 |
| 적 1체 | 파급 대상 없음, 정상 종료 |
| `target: all_enemies` 카드에 `chain` | **로드 시점에 거부** |

**조건식 7종** — 참/거짓 양쪽에서 평가
`favor(patron) >= n` · `favor(god) < n` · `has_token(target, t) >= n` · `turn > n` · `hp_pct(self) < n` · `deck_count(tag) >= n` · `enemy_count() >= n`

```bash
npm test -- dsl
```

---

## 산출

```
core/rules.ts                 op 실행, 조건식 평가
core/targeting.ts             대상 해석 + chain 파급
core/state.ts                 토큰 상태 자료구조 (주인공 · 적별)
core/__fixtures__/cards.ts    테스트용 카드
test/dsl.test.ts
```

---

## 지시

- **대상 집합을 먼저 확정하고 효과를 적용한다**(T-2)
- `displace` 발동 시 패턴 인덱스를 진행시키지 않는다. 지연된 행동이 다음 턴에 그대로 나온다
- `chain`은 제우스 귀속 연산자다(R-4.1). `target: enemy` 전용 검사를 여기서 하고, 게이트의 `token_scope` 필터에서도 검사한다
- 토큰 기본값은 조우 지속으로, 1회성 어휘만 소모형으로 만든다

**참조** — R-4.1 (토큰 의미와 지속), T-4 (DSL 어휘), R-7.4 (토큰 상태)

---

## 세션 종료

- [ ] `npm test -- dsl` 통과
- [ ] 순수성 테스트 통과
- [ ] 커밋

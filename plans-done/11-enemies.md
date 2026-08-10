# P-11 · 적과 조우 편성

`plans/11-enemies.md` · [◀ P-10](10-grace.md) · [색인](00-index.md) · [P-12 ▶](12-fusion.md)

**크기** 보통 · **착수 조건** P-06, P-09

---

## 완료 정의

픽스처 적이 생성된 `data/enemies.json`으로 교체되고 리포트에 `enemy_count_dist` `target_spread` `block_efficiency`가 나온다.

**`block_efficiency`가 0.8~1.2 안에 든다.**

조우 임계값(T-6)을 벗어난 편성이 게이트에서 반송된다.

```bash
npm run validate -- staging/enemies-underworld.json --apply
npm run sim -- --runs 500
```

---

## 산출

```
prompts/enemy-v1.md
data/enemies.json      pattern · groups · role · intent_visible
core/combat.ts         복수 적, 적별 의도 공개
sim/bots/rule.ts       대상 선택 · 광역 판단 검증
sim/report.ts          enemy_count_dist · target_spread · block_efficiency
tools/validate.ts      조우 단위 임계값 필터
```

---

## 조우 임계값

조우 단위 임계값을 개체 단위보다 우선 적용한다.

| 항목 | 지하 | 지상 |
|---|---|---|
| 조우 총 HP (`HP + bulwark`) | 40~90 | 90~170 |
| 조우 총 의도 피해 / 턴 | 8~14 | 14~22 |
| 조우당 적 수 | 1~2 | 2~3 |
| 보스 HP | 130 | 190 |
| 허용 손실 (전투 / 보스) | 12 / 30 | 18 / 40 |

---

## 지시

- 조우 편성은 적 스키마의 `groups` 필드로 정의한다(T-3.4)
- `intent_visible`을 true로 고정한다. 복수 적에서는 각 적의 의도를 개별 공개한다
- `role`은 닫힌 어휘로 유지한다: `pressure` · `attrition` · `applier` · `bulwark`
- `pattern_mode`는 `cycle` 또는 `conditional`만 허용한다
- **`block_efficiency`가 대역을 벗어나면 동결(P-13) 전에 봇 정책을 고친다**

**참조** — R-6.2, R-6.3, T-3.3, T-3.4, T-6

---

## 세션 종료

- [ ] `block_efficiency` 0.8~1.2
- [ ] 임계값 이탈 편성이 반송됨
- [ ] `prompts/enemy-v1.md` 커밋
- [ ] 커밋

# P-11 · 적과 조우 편성

`plans/11-enemies.md` · [◀ P-10](10-grace.md) · [색인](00-index.md) · [P-12 ▶](12-fusion.md)

**크기** 보통 · **착수 조건** P-06, P-09

---

## 완료 정의

픽스처 적이 생성된 `data/enemies.json`으로 교체되고, 리포트에 `enemy_count_dist` `target_spread` `block_efficiency`가 나온다.

**`block_efficiency`가 0.8~1.2 안에 든다.** 벗어나면 봇이 의도를 읽지 못하고 있다는 뜻이고, 그러면 승률의 원인이 게임이 아니라 계기다.

조우 임계값(T-6)을 벗어난 편성이 게이트에서 반송된다.

```bash
npm run generate -- --kind enemy --region underworld --count 40
npm run sim -- --runs 500
```

---

## 산출

```
prompts/enemy-v1.md
data/enemies.json      pattern · groups · role · intent_visible
core/combat.ts         복수 적, 적별 의도 공개
sim/bots/rule.ts       대상 선택 · 광역 판단 실측 검증
sim/report.ts          enemy_count_dist · target_spread · block_efficiency
tools/validate.ts      조우 단위 임계값 필터
```

---

## 구현 노트

**조우 단위 임계값이 개체 단위보다 우선한다**(T-3.4, T-6). 적 3체 조우는 각 적이 약해야 한다. 게이트는 각 `group`의 총 HP와 총 의도 피해가 구역별 범위 안인지 확인한다.

| 항목 | 지하 | 지상 |
|---|---|---|
| 조우 총 HP (`HP + bulwark`) | 40~90 | 90~170 |
| 조우 총 의도 피해 / 턴 | 8~14 | 14~22 |
| 조우당 적 수 | 1~2 | 2~3 |
| 보스 HP | 130 | 190 |
| 허용 손실 (전투 / 보스) | 12 / 30 | 18 / 40 |

**조우 편성은 `encounters.json`이 아니라 적 스키마의 `groups` 필드다**(T-3.4). 파일을 분리하면 게이트가 관리할 콘텐츠가 하나 늘고 통과율 지표가 쪼개진다.

**`intent_visible`을 true로 고정하는 것은 계기의 안정성 요건이다**(T-3.3). 의도가 공개되면 룰 봇의 방어 정책이 산술로 확정된다 — 합산 피해만큼 block을 쌓는다는 규칙에 해석의 여지가 없다. 비공개면 정책이 기대값 추정을 포함하게 되고, 추정 방식을 바꿀 때마다 계기가 흔들려 이전 회차 데이터가 무효가 된다.

**`block_efficiency`가 이 세션의 진짜 검증인 이유가 여기 있다.** 1에 가까우면 봇이 의도를 정확히 읽고 있다는 뜻이다. 크게 낮으면 초과 방어로 자원을 낭비하고 있고, 낮은 승률의 원인이 게임의 난이도가 아니라 봇의 미숙함이다. **동결 게이트 전에 이것을 확인해야 하는 이유는, 여기서 봇 정책을 고치는 것이 마지막 기회이기 때문이다.**

**`role`은 닫힌 어휘다**(T-3.3) — `pressure` `attrition` `applier` `bulwark`. 역할이 있어야 조우 편성이 의미를 갖고, 봇의 대상 선택이 편향되는지 역할별로 확인할 수 있다.

**`pattern_mode`는 `cycle` 또는 `conditional`만 허용한다.** 무작위 패턴은 승률 분산을 키워 이상치 탐지를 둔화시킨다(B-2).

**참조** — R-6.2 (대상 어휘), R-6.3 (적 구성), T-3.3 (적 스키마), T-3.4 (조우 구성), T-6 (조우 임계값)

---

## 세션 종료

- [ ] `block_efficiency` 0.8~1.2
- [ ] 임계값 이탈 편성이 반송됨
- [ ] `prompts/enemy-v1.md` 커밋
- [ ] 커밋

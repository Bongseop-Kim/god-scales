# P-13 · ⛔ 동결 게이트

`plans/13-freeze.md` · [◀ P-12](12-fusion.md) · [색인](00-index.md) · [P-14 ▶](14-matrix.md)

**크기** 짧음 · **착수 조건** P-08, P-09, P-11, P-12

---

## 완료 정의

`bot_policy_version`과 `global_param_version`이 v1로 찍히고 리포트에 기록된다. 그 전에 아래 넷을 끝낸다.

```bash
npm run play          # 사람 런 6~10회 (3~5명)
npm run sim -- --runs 2000 --stratified
```

---

## 동결 전 작업

### 1. 사람 플레이테스트 6~10런

`npm run play`(P-12)로 3~5명이 각 2런씩 돈다. 인원은 미리 섭외한다(A-4).

물어볼 것 — 상충 요구에서 어느 쪽을 왜 택했는지, 역린이 회복 불가능하게 느껴진 시점이 있었는지, 휴식과 전투 사이 선택이 실제로 고민이었는지.

**사람 런을 계측에 남긴다**(T-9.3).

### 2. HP 예산 확정

P-09의 `hp_curve` 실측과 사람 런을 함께 보고 R-8.3의 값을 확정한다. **판정 근거는 사람 플레이테스트다**(T-6 ⑤).

### 3. `block_efficiency` 확인

0.8~1.2 대역 안인지 본다(P-11). 벗어나면 **지금** 봇 정책을 고친다.

### 4. 룰 봇 승률 확인

분별 대역 15~70% 안인지 본다(T-6). 벗어나면 대역 안으로 되돌린다. 이 조정은 3번에 해당하므로 사람이 판단하고 계측에 남긴다.

---

## 동결 대상

| 항목 | 위치 | 버전 필드 |
|---|---|---|
| HP 예산 (최대 HP, 휴식 회복, 구역 클리어 회복) | `core/map.ts` · `core/combat.ts` | `global_param_version` |
| 호의 초기값 · 단계 경계 · 변동량 | `core/favor.ts` | `global_param_version` |
| 요구 보상 +12, 페널티 −18 / −9 / 없음 | `core/favor.ts` | `global_param_version` |
| 토큰 지속 · 소모 규칙 | `core/rules.ts` | `global_param_version` |
| 기본 전투 수치 (에너지 3, 드로우 5, 손패 10) | `core/combat.ts` | `global_param_version` |
| 룰 봇 정책 전체 (임계값 50% / 70% 포함) | `sim/bots/rule.ts` | `bot_policy_version` |

---

## 동결 이후 규칙

이 값들을 바꾸려면 —

1. 사람이 명시적으로 변경한다
2. 버전 번호를 올린다
3. `human_intervened`에 사유와 함께 남긴다
4. **이전 회차 데이터를 폐기한다**

**참조** — T-6 ⑤, T-6 (승률 분별 대역, 정책 버전), T-9.1, T-9.3

---

## 세션 종료

- [ ] 사람 런 6~10회 확보 및 계측 기록
- [ ] HP 예산 확정
- [ ] `block_efficiency` 대역 확인
- [ ] 룰 봇 승률 15~70% 확인
- [ ] `bot_policy_version = v1`, `global_param_version = v1` 기록
- [ ] **여기까지의 모든 조정을 `human_intervened`에 기록**
- [ ] 커밋 (태그: `freeze-v1`)

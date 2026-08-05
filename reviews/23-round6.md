# P-23 리뷰 · 6회차와 B-0 3번 첫 판정

`reviews/23-round6.md` · [◀ P-22](22-pool.md) · [색인](00-index.md) · [P-24 ▶](24-finish.md)

판정: **통과. 분산은 줄었다.** 0.0829063173828125 → **0.03533884008789062**. `pairing_win_stddev` 0.28793 → **0.18799**.

## 판정 규칙은 측정 전에 적었다

[reports/round-6/criterion.md](../reports/round-6/criterion.md)를 `npm run tune -- --iteration 6`보다 먼저 만들었다. 파일 순서가 그 증거다(criterion.md 10:46, simulation.json 10:52).

> 6회차 `pairing_win_stddev` < 5회차 0.28793457135747436 이면 감소, 아니면 감소 아님.

0.18799 < 0.28793 → **감소**.

`win_rate`는 판정 대상이 아니라고 미리 적었고, 실제로 0.377 → 0.302로 내려갔다.

## 압축 교란 — 미리 적었고, 갈랐다

전체 승률이 내려가면 조합별 승률이 0에 눌리면서 표준편차가 **기계적으로** 작아진다. 승률이 20%p 가까이 빠졌으므로 0.188 중 얼마가 수렴이고 얼마가 압축인지 이 통계 하나로는 가르지 못한다 — 숫자를 보고 나서 붙인 변명이 아니라는 게 중요해서 criterion.md에 미리 적었다.

**변동계수로 갈랐다.** 모든 셀에 상수 k를 곱하는 순수 압축은 sd와 mean에 같은 k가 붙으므로 **sd/mean을 바꾸지 못한다.**

| | sd | mean | **CV** |
|---|---:|---:|---:|
| 5회차 | 0.2879 | 0.3775 | **0.7628** |
| 6회차 | 0.1880 | 0.3017 | **0.6231** |

둘 다 줄었다 → 모양이 바뀐 것이다. 압축 설명은 배제된다.

같은 결론을 양끝도 말한다 — 승률이 내려가기만 했다면 최저 셀은 0.034보다 낮아졌어야 하는데 **올라갔다**(0.061). 천장은 0.866 → 0.640으로 내려왔다.

`summarize`에 `pairing_win_cv`를 넣고 `matrix.test.ts`에 **≤0.70**으로 함께 잠갔다. 앞으로는 승률을 떨어뜨려 편차 밴드를 통과하는 길이 막혀 있다. `tuning.json`과 `rounds.json`도 회차마다 CV를 들고 간다.

## 버전 — 올리지 않았고, 그래서 판정이 섰다

계획서는 "P-22가 게이트 규칙과 콘텐츠를 둘 다 바꿨으므로 `globalParamVersion` v3 → v4"라고 적었다. **올리지 않았다.**

P-20 표의 "바꾸면 안 됨"은 전역 파라미터 · 룰 봇 정책 · 승리 조건이다. P-22가 바꾼 것은 게이트 임계값(사유 기록함) · 카드 수치 · 요구 수치 · 신 어휘 데이터로 전부 "바꿔도 됨" 열이고 `enemyDamageScale`은 손대지 않았다.

여기서 올렸다면 기준선이 세 회차 연속으로 날아가 B-0 3번을 **또** 판정할 수 없었다. 계획서를 따르지 않은 자리이므로 여기 적는다.

## 6회차 수치 (64,000런)

| 지표 | 5회차 | 6회차 |
|---|---:|---:|
| 런 | 32,000 | 64,000 |
| `win_rate` | 0.377 | 0.302 |
| `pairing_win_stddev` | 0.288 | **0.188** |
| `block_efficiency` | 0.655 | 0.812 |
| `fusion_rate` | 0.061 | 0.063 |
| `low_rest_clear_rate` | 0.214 | 0.167 |
| `region_clear_rate` 지하/지상 | 0.920 / 0.377 | 0.950 / 0.302 |
| `devotion_ratio` | 0.223 | 0.255 |
| `wrath_ratio` | 0.00015 | 0.00010 |
| `upgrade_rate` | 0.632 | 0.716 |
| 평균 턴 | 93.0 | 78.7 |

`bot_policy_version=v4` · `global_param_version=v3` — 두 회차 동일.

## `mark` 반올림 재측정

5회차 표(승률 0.377 / 편차 0.288)는 `mark`의 1.5배를 정수로 반올림하기 **전** 코드였고, 반올림 후 값은 2,000런으로만 재고 산출물이 없었다. 6회차 64,000런이 그 자리를 대신한다 — 산출물은 [round-6/simulation.json](../reports/round-6/simulation.json)이다.

## 제우스 체크포인트

| 조합 | 5회차 | 6회차 |
|---|---:|---:|
| zeus+athena | 0.561 | 0.171 |
| zeus+poseidon | 0.050 | 0.112 |
| zeus+ares | 0.036 | 0.061 |
| zeus+artemis | 0.034 | 0.111 |
| **행 평균** | **0.170** | **0.114** |

행 평균은 내려갔지만 **네 셀 중 셋이 올라갔다.** 5회차의 0.170은 zeus+athena 한 셀(0.561)이 혼자 만든 값이고 나머지 셋은 0.034~0.050이었다. 지금은 0.061~0.171로 고르다.

P-22의 결론 그대로다 — 제우스의 0.561은 아테나의 거북 덱이 업고 있던 숫자였고, 지금의 값은 제우스 자신의 것이다. 다만 배포 조합 0.171은 여전히 낮다.

## 밴드 재동결

| 테스트 | 전 | 후 | 성격 |
|---|---|---|---|
| `matrix` pairing_win_stddev | ≤0.35 | **≤0.24** (측정 0.188) | **5회차 이래 덮여 있던 숫자를 처음 내려 잠갔다** |
| `map` low_rest_clear_rate | <0.38 | **<0.24** (측정 0.167) | 되돌아오는 방향 |
| `freeze` block_efficiency | 0.74~0.88 | 그대로 (측정 0.812) | P-22에서 이미 옮겼다 |
| `enemies` block_efficiency | 0.80~0.93 | 그대로 (측정 0.867) | P-22에서 이미 옮겼다 |
| `freeze` winRate | 0.15~0.70 | 그대로 (측정 0.302) | 통과 |

## 64,000런이 기본 힙에서 죽던 것 — 고쳤다

첫 실행이 `Ineffective mark-compacts near heap limit`으로 OOM 났다. `simulateStratified`가 64,000개 `RunResult`를 전부 배열에 들고 있는데 부피의 대부분이 `log: string[]`이고, 정작 읽는 쪽은 `--log`의 `results[0]` 하나뿐이었다.

두 줄로 끝났다. 스트리밍 집계는 만들지 않았다.

- `simulateStratified`가 첫 런 외의 `log`를 비운다 → **기본 힙에서 90초에 완주**한다(`--max-old-space-size` 불필요)
- `tune.ts`의 배증 규칙에 상한 64,000을 걸었다. 조합당 6,400런이면 승률 표준오차가 **±0.57%p**, 배증해도 ±0.41%p다 — 0.16%p를 사려고 메모리와 시간을 두 배 쓰던 자리다

재실행 결과가 이전과 **비트 단위로 같다**(`variance_after` 0.03533884008789062). 결정적이라는 증거이자 로그 제거가 집계를 건드리지 않았다는 증거다.

## 산출물

```
reports/round-6/criterion.md      측정 전 판정 규칙 (그대로 둔다 — 사후 가필하면 사전 등록이 아니다)
reports/round-6/simulation.json   64,000런 원본
reports/round-6/tuning.json       variance_before/after · cv_before/after · condition_rate_estimate · 개입/실패 기록
reports/rounds.json               rounds [5,6] · variances · coefficients_of_variation · decreasing true
reports/final.md                  6회차로 전면 갱신
reports/heatmap-v1.svg            재생성 (stddev 0.181, 2,000런)
reports/actor-comparison.json     재생성 (룰 봇 합성 6.8%, 라이벌 격차 +0.035)
```

`reports/notes.json`에 P-22·P-23의 `human_intervened` 8건과 `ai_failures` 5건을 추가했다. `tuning.json`은 그 파일을 읽는다.

## 검증

- `npm test`: 19파일, **63테스트 통과**
- `npm run tune -- --iteration 6`: 64,000런 완주
- `npm run report`, `npm run report -- --compare`: 재생성 완료

## 남은 것

- **완화의 종류를 구분하지 못하는 가중치.** 남은 부채는 사실상 이것 하나다 — `displace`·`deflect`는 적 공격 크기(1층 6~10 → 12층 14~22)에 비례해 막고 `block`은 고정인데 게이트는 셋을 고정 가중치로 잰다.
  **지금 고치지 않는다.** 이유 둘 — (1) P-25가 적 7종을 다시 쓰므로 곧 지울 적을 상대로 값을 매기게 된다, (2) `tokenWeights`는 봇의 `cardValue`와 같은 표라 건드리면 `botPolicyVersion`이 올라가고 방금 얻은 기준선이 폐기된다. 적이 확정된 뒤 **한 번만, 알고서** 리셋하는 것이 맞다
- **상한이 목표선이 됐다**(아테나 0.288 · 포세이돈 0.299 · 제우스 0.291) — 위 가중치 문제의 증상이다. 따로 손대지 않는다
- `demand_zeus_solo` 지킴률 0.738 — 대역 위. 조건을 3으로 올리면 `demand_zeus_multi`와 같아진다. **제우스만 요구가 둘이므로**(나머지 넷은 하나씩) 조이는 대신 지우는 것이 맞다. 포세이돈의 반대 극성 요구는 `demand_zeus_multi`와 그대로 맞물린다
- 배포 조합 0.171 — 낮지만 밴드 안이다. `enemyDamageScale`을 만지는 순간 그것도 기준선 리셋이므로 체감 문제는 P-25가 답할 자리다
- B-0 4번(배포본 일일 1런)은 여전히 미충족 — P-24

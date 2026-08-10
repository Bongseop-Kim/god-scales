# N-05 · 남은 선택을 사람에게

`plans/05-choices.md` · [◀ N-04](04-rewards.md) · [N-06 ▶](06-deploy.md)

**크기** 보통 · **착수 조건** N-04 · **축소 1순위** (버리면 봇이 계속 처리한다)

---

## 왜

N-01~N-04를 지나면 사람이 정하는 것은 갈림길·카드·타겟·보상이다. 남은 자동 처리는 셋이다.

| 지금 | 코드 |
|---|---|
| 휴식 종류와 제거 카드 | `chooseRest` · `chooseRestCard` — N-01이 yield까지 열었으나 UI가 없다 |
| 은총 마일스톤 카드 | `applyMilestones`가 **신의 첫 카드로 고정**. 봇조차 안 고른다 |
| 요구 수락 | `resolveDemand(..., true)` — **항상 수락**. `chooseDemand`는 에이전트 전용이고 엔진이 안 부른다 |

앞의 둘은 UI 작업이고, 요구는 규칙 작업이다. 크기가 다르므로 순서를 지킨다.

---

## 완료 정의

```bash
npm run dev
#   → 휴식 · 은총 · 요구를 직접 고르며 1런 완주 → 반출 → --replay 일치
npm test
#   → 51+ 테스트 통과. demands 테스트에 거절 경로 추가
```

**반출 `actions`에 `rest` · `rest_card` · `grace` · `demand`가 있어야 한다.**

---

## 순서

### 1. 휴식 (UI만)

N-01이 `rest` · `rest_card`를 이미 yield한다. 화면만 만든다. 회복 25(`restHealing`) 대 카드 제거의 선택이고, 제거는 덱 목록에서 고른다.

### 2. 은총 (규칙 한 줄 + UI)

`applyMilestones`가 `godDecks[god][0]`로 고정한 자리를 `phase: "grace"` yield로 바꾼다. `sim/bots/rule.ts:chooseGraceCard`가 이미 있다 — **엔진이 그걸 부르게만 하면 봇 경로가 채워진다.**

마일스톤 2는 카드 강화, 6은 비용 감소다(`upgradeCard` · `reduceCardCost`). 선택 대상은 **덱에 있는 그 신의 카드**다. 덱에 없는 카드를 강화하면 아무 일도 안 일어난다 — 지금 코드는 이 검사가 없다.

### 3. 요구 (규칙 작업)

`resolveDemand(favor, patron, other, true)`의 네 번째 인자가 수락 여부다. 항상 `true`다. 거절 경로를 연다.

| | 수락 | 거절 |
|---|---|---|
| 요구를 낸 신 | 호의 상승 | 변화 없음 |
| 상대 신 | `demandPenalty` 만큼 하락 | 변화 없음 |

- **거절에 별도 페널티를 만들지 않는다.** 상충 요구의 긴장은 "둘 중 누구를 화나게 할까"이지 "거절 벌금"이 아니다(R-5)
- `data/demands.json`의 요구를 화면에 문장으로 보여준다. `condition` DSL을 그대로 노출하지 않는다
- 거절이 가능해지면 `wrath` 도달률과 `conflict_outcomes`가 움직인다. **2000런으로 재측정하고 밴드 안인지 확인한다.** 벗어나면 N-04와 같은 방식으로 `enemyDamageScale`을 조정하고 `globalParamVersion`을 올린다

---

## 지시

- 세 덩이를 **각각 커밋 하나로** 끝낸다. 요구까지 못 가면 1·2만 하고 3은 리뷰에 미완으로 적는다
- `sim/handoff.ts`의 `PendingDecision["phase"]`가 `patron_pair | path`뿐이다. **여기서 넓히지 않는다** — LLM 에이전트를 전투 층까지 올리는 것은 이 세트 밖이다(백로그)
- 신 조합 선택도 이 세트 밖이다. 제우스+아테나 고정을 유지한다. 조합을 UI에서 열면 10조합 균등 시뮬의 전제가 흔들린다

**참조** — R-5, R-10(은총), `core/demands.ts`, `core/upgrade.ts`

---

## 세션 종료

- [ ] 휴식 화면 · 은총 카드 선택 · 요구 수락/거절이 동작
- [ ] `actions`에 `rest` · `rest_card` · `grace` · `demand` 포함, 재생 일치
- [ ] 거절 경로 테스트 추가, `npm test` 통과
- [ ] 요구를 못 했으면 리뷰에 미완으로 명시
- [ ] `reviews/05-choices.md`

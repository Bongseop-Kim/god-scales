# N-04 · 카드 보상과 재동결

`plans/04-rewards.md` · [◀ N-03](03-pool.md) · [N-05 ▶](05-choices.md)

**크기** 김 · **착수 조건** N-01 · N-02 · N-03

**이 세트의 마일스톤이다.** 여기를 지나면 덱빌딩이 성립한다.

---

## 왜

지금 플레이어의 덱이 늘어나는 경로는 합성 카드 1장뿐이다(`canFuse`가 참일 때 `deck.push`). 시작 덱 10장은 신 조합이 정하고, 12층 동안 **플레이어가 카드를 고르는 순간이 한 번도 없다.**

기본 카드 15장은 `sim/engine.ts`에 하드코딩돼 있고 전부 cost 1, `damage 7` · `damage 4` · `block 6`이다. 생성기가 만든 37장은 `apply_token`·`chain`·`draw`·`energy`를 쓰는데 게임에 안 들어간다. **DSL의 9개 op 중 실제 플레이에 나오는 것은 2개다.**

---

## 완료 정의

```bash
npm run sim -- --runs 2000 --stratified
#   → card_win_delta 에 card_ 접두 id 20종 이상
npm run sim -- --runs 2000 --stratified | tr ',' '\n' | grep -c '"card_'
#   → 20 이상
npm test
#   → freeze.test.ts 를 재측정한 밴드로 갱신한 뒤 통과
npm run dev
#   → 보상 화면에서 카드를 고르며 1런 완주 → 반출 → --replay 일치
```

**반출 JSON의 `actions`에 `reward` 항목이 있어야 한다.**

---

## 산출

```
sim/engine.ts       하드코딩 cards 배열 제거, data/cards.json 에서 시작 덱 구성
                    전투 승리 후 phase: "reward" yield
sim/bots/rule.ts    chooseReward (cardValue 재사용)
sim/replay.ts       ReplayAction 에 reward 추가
ui/reward.tsx       3택1 + 건너뛰기
core/favor.ts       globalParamVersion v1 → v2
test/freeze.test.ts 재측정한 밴드
data/cards.json     시작 덱 15장이 여기로 이관됨
```

---

## 세 덩이

### 1. 하드코딩 15장을 데이터로 이관

`sim/engine.ts`의 `cards` 배열과 `godDecks`를 없애고 `data/cards.json`에서 읽는다. 시작 덱은 **신별 태그로 고른다** — 공격 1종 · 방어 1종 · 나머지 1종. `godDecks`가 하던 3장 선택을 데이터가 하게 만든다.

- **시작 덱 10장 구성(신1 5장 + 신2 5장)과 그 비율을 바꾸지 않는다.** 이걸 같이 바꾸면 승률 변화의 원인이 둘이 된다
- `baseCardBalance` 보정은 이관 후에도 모든 `damage`/`block`에 걸린다. 지금 코드 그대로 둔다
- 이관 직후 **2000런을 돌려 승률이 얼마나 움직였는지 먼저 기록한다.** 보상을 넣기 전 숫자다

### 2. 전투 승리 후 보상

```ts
// playEncounter 가 victory 로 끝난 뒤, 은총·합성 처리보다 먼저
const offer = rewardOffer(rng, cardPool, patrons);      // 신 둘의 카드 중 3장
const picked = yield { phase: "reward", options: [...offer, ""], observation: { deck: deck.length } };
if (picked) deck.push(picked);
```

- 보상은 **조합에 속한 신 둘의 카드에서만** 뽑는다. 신 선택이 보상에 반영되는 지점이다
- **건너뛰기를 허용한다**(빈 문자열). 덱을 얇게 유지하는 것이 전략이다
- 보스 노드도 전투다. 런당 보상 기회는 최대 9회(전투 7 + 보스 2, 휴식을 고른 만큼 줄어든다)
- RNG는 **새 스트림을 쓴다** — `createRng(seed * 1000 + node)`처럼 기존 전투/셔플 스트림과 겹치지 않게. 겹치면 N-01이 지킨 기존 replay 재생이 깨진다
- **기존 19개 replay는 `reward` 액션이 없으므로 봇이 채운다.** 부분 덮어쓰기가 이걸 허용한다. 결과값은 달라지는 게 정상이다 — 이 세션은 회귀 무변화 세션이 아니다

### 3. 재동결

보상이 들어가면 덱이 강해지고 승률이 올라간다. **P-13 동결은 여기서 깬다.**

| 한다 | 하지 않는다 |
|---|---|
| 2000런으로 승률·블록 효율을 재측정한다 | 승률 목표 밴드(0.15~0.7)의 정의를 바꾼다 |
| `globalParamVersion`을 v2로 올린다 | `botPolicyVersion`을 건드린다 |
| 밴드를 벗어나면 `enemyDamageScale`을 조정한다 | 보상을 약하게 만들어 승률을 맞춘다 |
| `reports/round-*`를 폐기하고 사유를 적는다 | 옛 회차 숫자를 새 숫자와 같은 표에 둔다 |

**승률이 0.7을 넘으면 `core/map.ts:enemyDamageScale`(현재 0.45)을 올린다.** 이 값은 P-09·P-13에서 두 번 사람이 만진 자리다. 세 번째 개입을 `reports/final.md`의 `human_intervened`에 적는다.

조정 후 `npm run tune -- --iteration 4`로 자동 조정 루프를 한 바퀴 돌린다.

---

## 지시

- **UI는 보상 화면에서도 상태를 갖지 않는다.** `options`의 card id를 그리고 클릭을 엔진에 넘긴다. `ui/card.tsx`를 재사용한다
- 카드 일러스트가 없는 카드는 placeholder로 뜬다. **이 세션이 끝나면 `npm run art -- --list`가 진짜 작업 목록이다** — 실제로 화면에 뜨는 카드가 여기서 확정된다
- 보상 카드 3장이 손패의 카드와 같은 컴포넌트로 보여야 한다. 효과문이 안 읽히면 3택1이 무의미하다

**참조** — R-8.2, P-13 동결, T-9.3(`human_intervened`), A-2.3

---

## 세션 종료

- [ ] 시작 덱이 `data/cards.json`에서 온다 (`sim/engine.ts`에 카드 리터럴 없음)
- [ ] 보상 화면에서 카드를 고르며 1런 완주 → 반출 → 재생 일치
- [ ] `actions`에 `reward` 포함
- [ ] 2000런 `card_win_delta`에 `card_` 20종 이상
- [ ] `globalParamVersion=v2`, `freeze.test.ts` 갱신, `npm test` 통과
- [ ] 이관 직후 / 보상 후 / 조정 후 승률 세 숫자를 리뷰에 적는다
- [ ] `reports/final.md`의 `human_intervened`에 개입 기록
- [ ] `reviews/04-rewards.md`

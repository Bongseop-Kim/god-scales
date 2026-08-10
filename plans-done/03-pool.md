# N-03 · 카드 풀 확장

`plans/03-pool.md` · [◀ N-02](02-combat.md) · [N-04 ▶](04-rewards.md)

**크기** 보통 · **착수 조건** 없음 (N-02와 병행 가능)

여기서는 코드를 거의 만들지 않는다. **P-06에서 닫은 생성 루프를 나머지 4신에 대해 한 바퀴 더 돌린다.**

---

## 왜

`data/cards.json` 37장 중 비합성 27장이 **전부 제우스**다(`card_zeus_01~20`, `card_zeus_retry_01~07`). 생성기는 제우스에만 돌았다. 합성 10장은 10조합 전부 있다.

그래서 N-04의 보상 풀을 열면 어떤 조합을 골라도 **제우스 카드만 뜬다.** 신을 고르는 의미가 보상에서 사라진다.

토큰도 같은 문제다. `data/gods.json`이 신별 토큰을 정의하고 `ui/tokens.tsx`가 배지 9종을 그리는데, 지금 실제 플레이에 나오는 카드에는 `apply_token`이 없다(하드코딩 15장은 `damage`/`block`뿐). **배지가 장식이다.**

---

## 완료 정의

```bash
npm run validate -- staging/cards-poseidon.json --apply
npm run validate -- staging/cards-athena.json --apply
npm run validate -- staging/cards-ares.json --apply
npm run validate -- staging/cards-artemis.json --apply
npm test -- gate
#   → 게이트 7종 반송 테스트 통과
node -e '
const cards = JSON.parse(require("fs").readFileSync("data/cards.json","utf8"));
const by = {};
for (const c of cards) if (!c.patron_pair) by[c.patron] = (by[c.patron] ?? 0) + 1;
console.log(by);
const gods = ["zeus","poseidon","athena","ares","artemis"];
if (gods.some((g) => (by[g] ?? 0) < 12)) throw new Error("신별 12장 미달");
const tokens = cards.filter((c) => c.effects.some((e) => e.op === "apply_token")).length;
if (tokens < 15) throw new Error("apply_token 카드 15장 미달");
'
#   → 예외 없이 끝난다
```

**신별 12장, `apply_token` 카드 15장 이상.** 12장은 근거가 있는 숫자다 — N-04의 보상이 런당 최대 9회, 3택1이면 한 런이 훑는 카드가 최대 27장이고, 조합은 신 둘이므로 신별 12장이면 같은 카드가 매 보상마다 뜨지 않는다.

---

## 산출

```
staging/cards-poseidon.json   생성 결과 (신별)
staging/cards-athena.json
staging/cards-ares.json
staging/cards-artemis.json
staging/cards-<god>-retry.json  반송분 재생성
data/cards.json               --apply 로 합쳐진 결과
logs/generation/card-v1-<god>.md  통과·반송 기록
prompts/card-v1.md            신별 토큰·op 범위를 넣도록 고친 버전 (버전 올림)
```

---

## 지시

- **`prompts/card-v1.md`를 신마다 다시 쓰지 말고 파라미터화한다.** 신 id, 허용 토큰, 허용 op는 `data/gods.json`에 이미 있다. 프롬프트가 그 값을 받는 형태로 고치고 `prompt_version`을 올린다
- 게이트를 손대지 않는다. `tools/validate.ts`의 `token_scope`가 신의 토큰 범위를 검사한다 — **반송되면 프롬프트를 고치고 재생성한다.** 제우스도 retry 7장이 나왔다. 반송은 정상이다
- 반송률을 `logs/generation/card-v1-<god>.md`에 적는다. 프롬프트 수정 전/후로 나눠 적는다
- **수치 균형은 여기서 맞추지 않는다.** `value_outlier` 게이트만 통과하면 된다. 승률은 N-04에서 재동결할 때 본다
- 카드 이름과 효과문은 신의 성격을 따른다(R-3). 포세이돈은 `displace`/`soaked`, 아테나는 `bulwark`/`deflect`, 아레스는 `bleed`/`frenzy`, 아르테미스는 `mark`/`crit`

### 하지 않는 것

- 적 추가 — `data/enemies.json` 7체로 12층을 돈다. 부족하다는 근거는 아직 없다
- 요구 추가 — `data/demands.json`은 N-05에서 선택지로 올릴 때 본다
- 일러스트 — `npm run art -- --check` 목록은 N-04가 확정한다

**참조** — P-05 게이트, P-06 생성 루프, R-3, `data/gods.json`

---

## 세션 종료

- [ ] 4신 생성 → 게이트 통과 → `--apply`
- [ ] 완료 정의의 node 한 줄이 예외 없이 끝난다
- [ ] `npm test -- gate` 통과
- [ ] `logs/generation/`에 신별 반송률 기록
- [ ] `reviews/03-pool.md`

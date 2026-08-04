# N-02 · 사람이 카드를 낸다

`plans/02-combat.md` · [◀ N-01](01-steps.md) · [N-03 ▶](03-pool.md)

**크기** 김 · **착수 조건** N-01

새 연출도 새 에셋도 만들지 않는다. `ui/motion.css` · `ui/card.tsx` · `ui/tokens.tsx` · `ui/sfx.ts`는 이미 있다. 여기서 만드는 것은 **전투 화면 하나**다.

---

## 완료 정의

브라우저에서 **카드를 직접 내며** 1런을 완주하고, 반출한 JSON을 `--replay`가 재생해 같은 결과를 낸다.

```bash
npm run dev
#   → 카드 클릭으로 1런 완주 → 반출 → logs/human/run-play-1.json
npm run sim -- --replay logs/human/run-play-1.json
#   → 브라우저 런과 승패 · 도달 층 · 최종 호의가 일치
npm test -- ui
#   → 헤드리스에서 card 액션을 포함한 반출 재생이 일치
```

**반출 JSON의 `actions`에 `card` 항목이 있어야 한다.** `path`만 있으면 아직 봇이 싸운 것이다.

브라우저 확인은 `aside` CLI로 한다. 1세트에서 402(크레딧)로 막혔으므로, 막히면 `npm test -- ui`를 게이트로 쓰고 그 사실을 리뷰에 적는다. **테스트에 카드 액션이 들어간 케이스가 없으면 이 세션은 끝난 것이 아니다.**

---

## 산출

```
ui/combat.tsx   손패 · 에너지 · 적 HP와 의도 · 타겟 선택 · 턴 종료
ui/app.tsx      제너레이터를 ref 에 들고, yield 된 phase 로 화면을 고른다
test/ui.test.ts card 액션을 포함한 반출 재생 케이스 추가
```

---

## 범위

| 이 세션 | 이 세션 밖 |
|---|---|
| 카드 클릭 · 타겟 클릭 · 턴 종료 | 카드 보상 3택1 — N-04 |
| 적 HP · 블록 · 토큰 · **의도 표시** | 휴식 · 은총 · 요구 선택 — N-05. 봇이 계속 처리한다 |
| 에너지와 손패, 남은 뽑을 카드 수 | 신 조합 선택 — 제우스+아테나 고정 |
| 1440×900 좌측 쏠림 레이아웃 | 새 연출 · 새 에셋 |

**최소 범위** — 손패에서 카드를 골라 낼 수 있고 턴을 넘길 수 있으면 된다. 시간이 부족하면 휴식은 봇에게 맡긴다. N-01의 부분 덮어쓰기가 이것을 허용한다.

---

## 지시

### UI는 게임 상태를 갖지 않는다

React가 드는 것은 **제너레이터 핸들 하나(`useRef`)와 마지막 `yield` 값**뿐이다(I-3). HP·에너지·손패·적 상태는 매 yield마다 엔진이 준 `observation`을 그린다. `useState`에 전투 상태를 복사하면 두 개의 진실이 생긴다.

```ts
const steps = useRef<Generator<Decision, RunResult, string>>(null);
const [pending, setPending] = useState<Decision>();

const answer = (choice: string) => {
  const next = steps.current!.next(choice);
  setActions((all) => [...all, { type: pending!.phase, choice }]);
  next.done ? finish(next.value) : setPending(next.value);
};
```

- **`options`에 없는 값을 엔진에 보내지 않는다.** 에너지가 부족한 카드는 버튼을 비활성화해서 막는다. 엔진에 못 내는 카드를 보내고 예외를 받는 구조를 만들지 않는다
- `phase: "card"`에서 **턴 종료는 `options`에 없는 선택**이다. 엔진이 `undefined`(빈 문자열)를 턴 종료로 받도록 N-01의 드라이버와 같은 규약을 쓴다. 봇의 `chooseCard`가 `undefined`를 반환하는 것과 같은 자리다
- 반출 형식은 `{ seed, actions, replay_mode: "action_log" }` 그대로다. `ui/export.ts`를 그대로 쓴다
- **클라이언트 저장소를 쓰지 않는다**(T-1.1)

### 적 의도

봇은 `sim/bots/rule.ts:intent()`로 다음 턴 피해를 이미 읽는다. 사람에게 감추면 봇보다 불리한 게임이 된다. `observation`에 담긴 값을 적 위에 그린다. `data/enemies.json`의 `intent_visible`이 false인 적은 가린다.

### 연출은 재사용만

`ui/motion.css`의 easing 변수와 `--ease-out`을 쓴다. 카드 press는 CSS transition, 손패 퇴장은 Motion의 exit, 피해 숫자는 팝 400ms. **새 애니메이션 규격을 만들지 않는다**(A-2.6에 표가 있다).

**참조** — I-3, T-1.1, A-2, A-2.6, R-8.2

---

## 세션 종료

- [ ] 브라우저에서 카드를 내며 1런 완주
- [ ] 반출 JSON의 `actions`에 `card` 포함
- [ ] `npm run sim -- --replay`로 재생 일치
- [ ] `test/ui.test.ts`에 card 액션 케이스 추가, `npm test` 통과
- [ ] `localStorage` / `IndexedDB` / `document.cookie` 문자열이 `ui/`에 없음
- [ ] `reviews/02-combat.md`

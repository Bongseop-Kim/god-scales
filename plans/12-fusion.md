# P-12 · 합성 카드와 CLI 플레이

`plans/12-fusion.md` · [◀ P-11](11-enemies.md) · [색인](00-index.md) · [P-13 ▶](13-freeze.md)

**크기** 보통 · **착수 조건** P-10

---

## 완료 정의

**둘 다** 통과한다.

**1. 합성 카드**
`by_pairing` 통과율이 10칸 전부에서 0이 아니고, `fusion_rate`와 `fused_deck` 시나리오가 동작한다.

**2. CLI 플레이**
`npm run play`로 사람이 1런을 완주하고, 그 런이 `{seed, actions}`로 반출되어 `--replay`가 같은 결과를 낸다.

```bash
npm run validate -- staging/fused-*.json --apply
npm run sim -- --runs 200 --scenario fused_deck
npm run play
npm run sim -- --replay logs/human/*.json
```

---

## 산출

```
core/fusion.ts               합성 조건 판정, 획득
prompts/fusion-{조합}.md     10개
data/cards.json              합성 카드 10종 추가
sim/play.ts                  CLI 플레이 모드
sim/replay.ts                action 로그 재생
```

---

## 합성 조건

조우 승리 시점에 둘을 동시에 만족한다.

1. 두 신의 호의가 모두 70 이상
2. 그 조우에서 각 신의 카드를 각각 2장 이상 사용

달성 시 합성 카드 1장이 즉시 덱에 들어온다. **런당 1회.**

코스트 2~3, 기대값 허용 범위 6.0~10.0, `exhaust` 없음. `favor(patron)`은 두 신 중 낮은 쪽(T-3.1).

---

## 지시

### CLI 플레이 모드

`sim/runner.ts`의 봇 자리에 표준 입력을 끼운다. 전투 로그는 P-04에서 이미 만들었다.

반출 형식을 `{seed, actions, replay_mode: "action_log"}`로 확정한다. P-17이 같은 형식을 쓴다.

**사람 플레이테스트를 P-13 전에 이 모드로 돌린다**(A-4).

### 생성

- **조합별로 생성한다.** 프롬프트가 두 신의 토큰 어휘를 동시에 노출한다
- `pass_rate`를 조합별(`by_pairing`)로 따로 기록한다
- **한쪽 어휘만 쓰는 합성 카드를 `fusion_scope`로 반송한다**

### 봇 정책 추가

| 판단 | 정책 |
|---|---|
| 합성 시도 | 두 신이 우연히 70 이상이 되면 그 조우에서 양쪽 카드를 2장씩 쓰도록 순서만 조정 |

**참조** — R-3.5, R-3.6, T-3.1, T-1.1

---

## 세션 종료

- [ ] `by_pairing` 10칸 전부 0이 아님
- [ ] `npm run play` 1런 완주 + 재생 일치
- [ ] `prompts/fusion-*.md` 10개 커밋
- [ ] 커밋

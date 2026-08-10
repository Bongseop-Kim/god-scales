# P-06 · 생성기 — 루프가 닫힌다 ★

`plans/06-generator.md` · [◀ P-05](05-gate.md) · [색인](00-index.md) · [P-07 ▶](07-favor.md)

**크기** 보통 · **착수 조건** P-04, P-05

---

## 완료 정의

한 바퀴가 돈다.

```bash
# 1. 생성 — Claude Code 세션이 prompts/card-v1.md 를 읽고 staging/ 에 쓴다
# 2. 게이트
npm run validate -- staging/cards-zeus.json --apply
#      → pass_rate 와 failure_breakdown 출력, 통과분만 data/cards.json 에 반영
# 3. 시뮬
npm run sim -- --runs 200
```

`pass_rate`가 **0%도 100%도 아닐 것.**

**반송분을 같은 프롬프트로 재생성해 두 번째 바퀴를 돈다.**

---

## 산출

```
prompts/card-v1.md       카드 생성 프롬프트
data/gods.json           손으로 쓰는 유일한 데이터
staging/                 세션 출력이 게이트 전에 머무는 곳
data/cards.json          통과분
logs/generation/         생성 세션 트랜스크립트
```

`data/gods.json`은 5신의 `id` `name` `tokens` `ops` `rivals` `stage_effects` `demands`만 담는다. 호의 상수·단계 경계·마일스톤은 `core/favor.ts` 상수다(T-3.2).

---

## 지시

### 생성 수단

`tools/generate.ts`를 만들지 않는다. 카드는 Claude Code 세션이 쓰고 `tools/`는 게이트와 반영만 한다(A-6).

사람의 개입은 스키마·임계값·프롬프트 수정으로 한정한다(I-5). 카드 내용을 손으로 고치면 `human_intervened`에 남긴다.

### 반송 경로

```
프롬프트 → 세션이 30장 생성 → staging/
  → npm run validate → 통과 / 반송 + failure_breakdown
  → 반송 사유를 세션에 다시 넣는다 → 재생성
  → npm run validate → ...
```

리포트에는 **"게이트가 반송하면 반송 사유와 함께 재생성했다"**로 적는다.

### 트랜스크립트

생성 세션 트랜스크립트를 `logs/generation/`에 저장하고 커밋한다.

### 프롬프트

- 프롬프트에 스키마 예시를 그대로 넣고 "이 형식 외의 텍스트를 출력하지 마라"를 명시한다
- 게이트가 파싱 실패 위치를 정확히 보고하게 한다. 그 메시지가 다음 바퀴의 입력이다
- 목표 수량의 5~10배를 과잉 생산한다(T-6)
- 해당 신의 토큰 어휘와 성향만 노출한다
- 한 세션 안에서 한 신을 끝낸다
- `prompts/` 아래 파일로 관리하고 버전을 매긴다(B-1)

### 통과율 대응

통과율이 0%에 가까우면 **임계값이 아니라 프롬프트를 고친다.**

**참조** — T-5, T-6 ②, T-3.1, T-3.2, I-5, A-6

---

## 세션 종료

- [ ] 생성 → 게이트 → 시뮬 관통
- [ ] **반송분 재생성으로 두 번째 바퀴 완주**
- [ ] `pass_rate`가 0%도 100%도 아님
- [ ] `prompts/card-v1.md` 커밋
- [ ] `logs/generation/` 트랜스크립트 커밋
- [ ] **`ai_failures`에 이번 세션의 실패 사례 기록**
- [ ] 커밋

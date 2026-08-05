# card-v1 · artemis · 2026-08-04

프롬프트: `prompts/card-v1.md`
토큰: `mark`, `crit` · 귀속 연산자: 없음 (공통 연산자만)

## 1회차 — 프롬프트 수정 전 (`card-v1.1`, 제우스 전용 문구)

- 생성: 20장 (`staging/cards-artemis.json`)
- 통과: 16장
- `pass_rate`: 0.8
- `failure_breakdown`: `token_scope` 2, `value_outlier` 1, `duplicate` 1

반송 4장은 모두 신 어휘 이탈과 기대값 이탈이다. 제우스 전용으로 쓰인 프롬프트를 그대로 쓰면
`shock`·`chain`이 새어 들어오고, 토큰 가중치를 모르니 값싼 토큰만으로 채운 카드가 하한을 못 넘긴다.

## 프롬프트 수정 — `card-v1.2`

- 신 id·토큰·귀속 연산자를 `data/gods.json`에서 채우는 자리로 바꿨다. 신마다 프롬프트를 복사하지 않는다
- `tools/value.ts`의 기대값 식과 토큰 가중치 9종을 프롬프트에 넣었다
- 중복 지문 규칙(`op:floor(값/3)`)과 기준 카드 충돌(단일 `damage 6~8`)을 적었다

## 2회차 — 수정 후

- 재생성: 4장 (`staging/cards-artemis-retry.json`)
- 통과: 4장
- `pass_rate`: 1.0
- `failure_breakdown`: 없음

## 최종

- `data/cards.json` 반영: artemis 20장

## ai_failures

- `token_scope`: 제우스 어휘(`shock`, `chain`)와 타 신 토큰 유입 → 프롬프트에 허용 토큰을 파라미터로 고정
- `value_outlier`: 토큰 가중치를 모른 채 스택만 늘리거나 줄임 → 기대값 식과 가중치표를 프롬프트에 명시
- `duplicate`: 3 단위 버킷 지문 충돌 → 값 간격과 효과 순서로 지문을 분리

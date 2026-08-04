# card-v1 · zeus · 2026-08-04

프롬프트: `prompts/card-v1.md`

## 1회차

- 생성: 30장 (`staging/cards-zeus.json`)
- 통과: 20장
- `pass_rate`: 0.6666666666666666
- `failure_breakdown`: `value_outlier` 2, `token_scope` 2, `dsl_parse` 3, `schema` 2, `duplicate` 1
- 반송된 10장은 반송 키와 함께 같은 프롬프트로 재생성했다.

## 2회차

- 재생성: 10장 (`staging/cards-zeus-retry.json`)
- 통과: 7장
- `pass_rate`: 0.7
- `failure_breakdown`: `token_scope` 1, `value_outlier` 1, `duplicate` 1
- 최종 반영: `data/cards.json` 27장

## ai_failures

- `schema`: 소유 필드 중복과 대상 열거형 이탈 → 반송 사유를 재생성 입력에 포함
- `dsl_parse`: 미정의 연산자·토큰·조건식 → 허용 어휘를 다시 제한
- `token_scope`: 제우스 외 토큰과 잘못된 `chain` 대상 → 제우스 어휘와 대상 규칙을 재강조
- `duplicate`: op 시퀀스와 수치 버킷 중복 → 효과 조합을 변경
- `value_outlier`: 코스트당 기대값 범위 이탈 → 같은 임계값으로 새 카드 생성

게이트가 반송하면 반송 사유와 함께 재생성했다.

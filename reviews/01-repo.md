# P-01 리뷰 · 저장소와 순수성 게이트

판정: 통과.

- Mulberry32 시드 RNG와 순수 `core/` 경계를 구성했다.
- `test/purity.test.ts`, `test/rng.test.ts`가 비결정적·브라우저·도구 의존을 막는다.
- 최초 커밋: `5c8cb96`.

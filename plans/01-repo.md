# P-01 · 저장소와 순수성 게이트

`plans/01-repo.md` · [색인](00-index.md) · 다음 [P-02 ▶](02-dsl.md)

**크기** 짧음 · **착수 조건** 없음

---

## 완료 정의

`npm test`가 세 가지를 통과한다.

1. **시드 재현** — 같은 시드로 만든 두 PRNG 인스턴스가 난수 1000개를 동일하게 낸다
2. **`core/` 순수성** — `core/` 아래 소스에 아래 문자열이 하나도 없다
   ```
   Math.random   Date.now   new Date   fetch(   window.   document.
   require(   from "../sim   from "../ui   from "../tools
   ```
3. **빌드** — `npm run build`가 통과한다

```bash
npm test
npm run build
```

---

## 산출

```
package.json          TypeScript strict, Vite, vitest
tsconfig.json         strict: true
core/rng.ts           시드 기반 PRNG
core/state.ts         상태 타입 (덱 · 전투 · 호의 · 맵 진행)
core/__fixtures__/    빈 디렉터리 — 픽스처가 들어갈 자리
test/purity.test.ts   순수성 grep 테스트
test/rng.test.ts      시드 재현 테스트
README.md             검증 명령 목록
```

---

## 구현 노트

**왜 첫 세션인가.** I-1(순수성)과 I-2(재현성)는 나중에 붙일 수 없다. 나중에 붙이면 이미 위반한 코드를 찾아 고치는 작업이 되고, 그 작업은 세션 하나로 끝나지 않는다. 순수성 테스트는 grep 한 줄이므로 지금 넣는 비용이 0에 가깝다.

**의존 방향은 단방향이다**(T-2). `core/`는 아무것도 import하지 않는다. 순수성 테스트의 `from "../sim` 검사가 이것을 지킨다.

**PRNG는 아무거나 쓰되 고정한다.** xorshift128이든 mulberry32든 상관없지만, 바꾸면 이전 로그의 재현이 깨진다. 한 번 고르고 커밋에 이유를 남긴다.

**`core/__fixtures__/`를 지금 만든다.** P-02부터 픽스처가 필요하고, 이 디렉터리가 존재해야 `data/`와의 경계가 처음부터 분명해진다(I-5는 `data/`에 대한 규칙이다).

---

## 세션 종료

- [ ] `npm test` 통과
- [ ] `npm run build` 통과
- [ ] `README.md`에 검증 명령 기록
- [ ] 커밋

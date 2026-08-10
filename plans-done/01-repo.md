# P-01 · 저장소와 순수성 게이트

`plans/01-repo.md` · [색인](00-index.md) · [P-02 ▶](02-dsl.md)

**크기** 짧음 · **착수 조건** 없음

---

## 완료 정의

`npm test`가 셋을 통과한다.

1. **시드 재현** — 같은 시드로 만든 두 PRNG 인스턴스가 난수 1000개를 동일하게 낸다
2. **`core/` 순수성** — `core/` 아래 소스에 아래 문자열이 없다
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
core/__fixtures__/    빈 디렉터리
test/purity.test.ts   순수성 grep 테스트
test/rng.test.ts      시드 재현 테스트
README.md             검증 명령 목록
```

---

## 지시

- PRNG를 하나 고르고 고정한다. 커밋 메시지에 선택을 남긴다
- `core/`는 아무것도 import하지 않는다(T-2). 순수성 테스트의 `from "../sim` 검사가 이를 강제한다
- `core/__fixtures__/`를 지금 만든다. P-02부터 픽스처가 들어간다

---

## 세션 종료

- [ ] `npm test` 통과
- [ ] `npm run build` 통과
- [ ] `README.md`에 검증 명령 기록
- [ ] 커밋

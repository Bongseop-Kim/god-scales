# N-06 · 배포와 공개 완주

`plans/06-deploy.md` · [◀ N-05](05-choices.md)

**크기** 짧음 · **착수 조건** N-02 이후 아무 때나. 콘텐츠가 바뀌면 다시 돌린다

1세트에서 Pages 워크플로와 로컬 HTTP 200까지는 통과했다. **막힌 것은 커밋·푸시 금지 지침 하나다.** 이 세션은 사용자가 그 턴에 푸시를 지시할 때만 끝난다.

---

## 완료 정의

```bash
npm run build
grep -rE "sk-ant|ANTHROPIC_API_KEY" dist/     # 결과 없음
grep -rl "validate\|tune" dist/               # 결과 없음
npm run size                                  # 크기 위반 0
# 푸시 지시를 받은 뒤
curl -sI https://bongseop-kim.github.io/god-scales/ | head -1   # 200
#   → 공개 URL 에서 카드를 내며 1런 완주 → 반출 → npm run sim -- --replay 일치
```

**공개 URL에서의 1런이 게이트다.** 로컬 200은 이미 통과한 상태다.

---

## 산출

```
dist/            정적 빌드
logs/human/      공개 URL 에서 반출한 런
README.md        배포 URL · 실행 방법 · 검증 명령 전체 · 조작 설명 갱신
```

---

## 지시

- LLM 호출은 `tools/` 아래 빌드타임 경로에만 있다(T-1). 위 grep 두 줄로 확인한다
- **`README.md`를 실제와 맞춘다.** 현재 문서는 "네 번의 갈림길을 선택하고, 전투는 결정론적 룰 봇이 자동으로 진행하는" 프로토타입이라고 쓰여 있다. N-02·N-04를 지나면 거짓이다
- 공개 URL에서 반출한 런을 `logs/human/`에 넣어 집계에 합친다. 지금 19개다
- 브라우저 확인은 `aside` CLI로 한다. `aside exec`는 모델을 써서 크레딧에 걸린다 — `aside repl`을 쓴다

```bash
open -a Aside   # 앱이 떠 있어야 확장이 붙는다
aside repl "const p = await openTab('https://bongseop-kim.github.io/god-scales/'); ..."
```

1세트에서 402(크레딧)로 막혔다. 또 막히면 **헤드리스 검증 + 사용자 육안 확인**으로 대체하고 리뷰에 적는다. 공개 URL 200과 반출 재생 일치까지는 크레딧 없이 확인된다.

- 배포 직후부터 **1런 완주를 매일 재확인한다**(B-0의 4번 조건). 1세트에서 유일하게 미충족인 조건이다

---

## 세션 종료

- [ ] `npm run build` · grep 두 줄 · `npm run size` 통과
- [ ] (푸시 지시 후) 공개 URL 200
- [ ] 공개 URL에서 카드를 내며 1런 완주, 반출 → 재생 일치
- [ ] `README.md`가 실제 조작과 일치
- [ ] `reports/final.md`에 B-0 4번 조건 갱신
- [ ] `reviews/06-deploy.md`

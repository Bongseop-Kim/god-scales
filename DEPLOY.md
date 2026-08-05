# 배포

GitHub Pages · <https://bongseop-kim.github.io/god-scales/>

콘텐츠가 바뀌면 다시 돌린다. **푸시는 사용자가 그 턴에 지시할 때만 한다.**

## 게이트

```bash
npm run build
grep -rE "sk-ant|ANTHROPIC_API_KEY" dist/   # 결과 없음
grep -rl "validate\|tune" dist/             # 결과 없음 (LLM 호출은 tools/ 빌드타임에만)
npm run size                                # 위반 0
# 푸시 뒤
curl -sI https://bongseop-kim.github.io/god-scales/ | head -1   # 200
```

**공개 URL에서 카드를 내며 1런 완주 → 반출 → `npm run sim -- --replay` 일치가 최종 게이트다.**
반출한 런은 `logs/human/`에 넣어 집계에 합친다.

## 브라우저 확인

`aside repl`만 쓴다. `aside exec`는 모델을 써서 크레딧에 걸린다.

```bash
open -a Aside   # 앱이 떠 있어야 확장이 붙는다
aside repl "const p = await openTab('https://bongseop-kim.github.io/god-scales/'); ..."
```

크레딧(402)으로 막히면 헤드리스 검증 + 사용자 육안 확인으로 대체하고 리뷰에 적는다.
공개 URL 200과 반출 재생 일치는 크레딧 없이 확인된다.

## 남은 것

- `README.md` — 현재 `[추후 예정]`. 실제 조작(12층 지도 · 카드 플레이 · 보상 선택)에 맞춰 다시 쓴다
- `reports/final.md` B-0 4번 조건(1런 완주) 갱신 — 배포 후 매일 재확인

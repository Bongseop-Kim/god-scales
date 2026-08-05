# 배포

GitHub Pages · <https://bongseop-kim.github.io/god-scales/>

`main`에 푸시하면 워크플로가 `npm test` → `npm run build` → Pages 배포까지 한다.
콘텐츠가 바뀌면 다시 돌린다. **푸시는 사용자가 그 턴에 지시할 때만 한다.**

## 게이트

```bash
npm test                                    # 19파일 63테스트
npm run build
grep -rE "sk-ant|ANTHROPIC_API_KEY|OPENAI|api_key" dist/   # 결과 없음
grep -rlE "\bvalidate\b|\btune\b" dist/     # 결과 없음 (LLM 호출은 tools/ 빌드타임에만)
npm run size                                # 위반 0
npm run e2e -- --dist                       # 최종 게이트 (아래)
# 푸시 뒤
curl -sI https://bongseop-kim.github.io/god-scales/ | head -1   # 200
```

## 최종 게이트 — `npm run e2e -- --dist`

**빌드 산출물을 브라우저로 12층 완주 → 반출 → CLI 재생 일치.** dev 번들이 아니라 `dist/`를 `vite preview`로 띄워 공개 URL에 올라가는 것과 같은 파일을 누른다.

한 번에 다음을 잰다.

- 여덟 결정 화면을 전부 지나고 **12층 완주**한다 (시드 141, 503결정, 3~4분)
- 반출 JSON의 결정 순서가 브라우저에서 누른 순서와 같다
- `run(seed, 반출 액션)`의 승패·층수·최종 체력·전투 횟수·호의가 화면 요약과 같다
- `substituted = 0` — 반출한 결정이 전부 지금 규칙에서 낼 수 있는 것이다
- 1440px에서 여덟 화면 모두 가로 넘침 없음, 2열 격자에 빈 칸 없음

클릭 정책은 화면에 적힌 것만 쓴다(비용·표시 피해·적 체력). 룰 봇을 브라우저로 옮겨 심지 않는다 — 두 번째 진실이 생긴다. 정책이나 콘텐츠가 바뀌면 완주하는 시드를 다시 찾아야 한다(400개 중 다섯: 51·69·141·162·291).

## 브라우저 확인

`aside repl`만 쓴다. `aside exec`는 모델을 써서 크레딧에 걸린다.

```bash
open -a Aside   # 앱이 떠 있어야 확장이 붙는다
```

Aside는 CDP `Emulation.*`을 막는다 — 뷰포트는 앱 창 크기가 그대로 쓰인다.
크레딧(402)으로 막히면 헤드리스 검증 + 사용자 육안 확인으로 대체하고 리뷰에 적는다.
공개 URL 200과 반출 재생 일치는 크레딧 없이 확인된다.

## 남은 것

- **공개 URL의 번들이 P-21 시점이다.** 6회차 콘텐츠(P-22의 카드·요구·신 어휘)는 아직 안 올라갔다 — 푸시 지시가 있어야 한다
- **"매일 재확인"은 아직 없다.** 최종 게이트가 Aside 앱을 요구해 GitHub Actions에서 못 돈다. 지금은 배포 직전 수동 실행이고, 자동화하려면 헤드리스 브라우저를 붙이거나 매일 도는 것을 `npm run sim -- --replay`로 낮춰야 한다
- 반출 런을 `logs/human/`에 합치는 것은 **사람이 직접 논 런만** 넣는다. E2E는 자동 클릭 정책이라 사람 플레이테스트 집계에 섞지 않는다

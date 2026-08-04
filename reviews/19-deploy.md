# P-19 리뷰 · 배포와 반출

판정: 배포 완료. 브라우저 완주는 미실행.

- GitHub Pages를 Actions 소스로 활성화했다(`gh api -X POST .../pages -f build_type=workflow`). 첫 워크플로 실행은 Pages 미활성으로 `configure-pages`에서 실패했었고, 원인은 코드가 아니라 저장소 설정이었다.
- 재실행(run 30893585559) 통과 후 <https://bongseop-kim.github.io/god-scales/>가 `200`을 반환한다. JS·CSS·webp 산출물도 모두 `200`이다.
- 배포된 번들에 `sk-*` · `api_key` · `ANTHROPIC` · `OPENAI` 문자열이 없다.
- Aside 스모크 통과: `title`·`h1` = `신들의 저울`, 시드 입력칸과 `런 시작` 버튼 존재, `#app` 렌더됨, 깨진 이미지 0, 콘솔·`pageerror` 메시지 0. `aside repl`은 모델을 쓰지 않아 크레딧과 무관하다(`aside exec`는 기본 제공자가 402).
- **완주 런은 남았다.** 지금 화면은 갈림길 4클릭뿐이라, 완주 E2E는 사람 조작 화면을 붙인 뒤 한 번만 짜는 것이 맞다.
- 1440×900에서 본문이 좌측 컬럼에 몰리고 우측이 비어 있다. 조작 화면 작업 때 함께 본다.

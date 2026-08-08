# R-57 · 토큰 아이콘 13종

`reviews/57-token-icons.md` · [색인](00-index.md) · 관련 [R-33](33-icons.md) · [R-37](37-wire.md)

## 결론

**통과 · 계획 하나를 환경이 되돌렸다.** 13종(`tokenNames`) 전용 아이콘이 배지·사전·전투 발밑
칩에 선다. 배지 틀(38 원형 · 진영 외곽/채움 · 지속 테두리 · 진영색) 불변 — 바뀐 것은 안의 그림
하나다. `npm run art -- --check`에 tokens 13종 대조가 들어갔다. 규칙·값·데이터·봇 불변.

## 계획과 다른 것 — 생성 수단

**이 환경에는 GPT-image가 없다**(옛 리뷰의 「built-in ImageGen」은 다른 환경의 도구다).
계획의 실제 요구는 「24px에서 읽히는 실루엣 · 얇은 선 금지 · 무채색 단색으로 뽑아
`--token-color`가 틴트」였고, 그 스펙은 **12×12 픽셀 격자 비트맵**이 정확히 충족한다 —
`art/_src/tokens/gen.mjs`가 격자 문자열 13벌을 들고 결정적으로 그린다(다시 돌리면 같은 픽셀).
원본 192×192 PNG(흰색+알파)는 `art/_src/tokens/`, 배포는 `magick`으로 `art/tokens/*.webp`
(무손실, 장당 64~100**바이트**) — 입·출력 경로 분리와 md 13개는 관례 그대로다.

모양: 감전 번개 · 밀려남 » · 침수 물방울 · 방벽 성벽 · 반사 되튀는 화살 · 가시 가시 셋 ·
위력 받침 위 화살표 · 출혈 베임+핏방울 · 광란 손톱자국 셋 · 표식 과녁 · 치명 네 갈래 별 ·
고갈 모래시계 · 안개 안개층 셋.

## 구현

- **연결** — `TokenBadge`의 `<Icon name={token} />`을 glob(eager) + **`mask`**로 바꿨다.
  계획은 `<img>`라 했지만 img는 `--token-color` 틴트가 안 된다 — 흰 알파 원본을 mask로 쓰고
  배경색이 칠하는 카드 프레임(`.game-card::before`)과 같은 수법이다. 13장이 번들에 실리므로
  폴백 없음(R-33과 같은 판단). 사전(P-53)·전투 칩은 `TokenBadge`를 쓰므로 자동으로 바뀌었다
- **`icons.svg`의 토큰 심볼은 남는다** — 카드 효과 줄(`Effect`)과 의도(`intentBits`)가 계속
  쓴다. 두 자리(배지 vs 효과 줄)의 그림이 다르지만 채널이 다르다: 배지는 「지금 붙은 상태」,
  효과 줄은 「이 카드가 붙일 것」
- **게이트** — `tools/art.ts`에 `{ kind: "tokens", missing: missingFrom(tokenArt, tokenNames) }`.
  토큰을 새로 만들면 아이콘이 없다고 게이트가 막는다. `tools/size.ts`에 `art/tokens`(+ P-54·55의
  케니 조각 4개 — CSS `url()`로 번들에 실리는데 안 세고 있었다)를 넣었다

## 남긴 것 — 번들 4.42MiB (상한 4)

`npm run size`가 **이 작업 전부터** 4.42MiB로 상한을 넘고 있었다 — 토큰 13장은 합계 1KiB,
케니 4장은 9KiB고, 초과분은 `art/fx`(659KiB — R-50의 재생성)와 `art/cards`(1.24MiB)다.
CLAUDE.md의 「통과 못 하는 값을 깎지도 않는다」를 따라 상한도 에셋도 여기서 손대지 않았다 —
fx 재압축은 그 에셋을 만든 자리의 판단이다.

## 검증

```text
npx tsc --noEmit         통과
npm test                 24파일 · 179테스트 통과
npm run art -- --check   made=249/249 · tokens 13/13 · 대조 위반 0
npm run e2e              e2e ok (첫 실행은 R-52와 같은 reward overflowX 플레이크 — 재실행 통과.
                         원인은 `body` 흔들림이었고 사후 수정에서 닫혔다 — [R-52](52-ui-split.md) 끝)
aside 실측               사전 13행 전부 mask 렌더(20px · --token-color 틴트) · 접촉 시트 확인
```

# `shock.webp` — 감전 토큰 아이콘

[P-57](../../reviews/57-token-icons.md) · [원본 규칙](../README.md)

**파일** 192×192 WebP 무손실, 흰색 + 알파. **화면** 20px(38px 배지 안) — 배지의 `--token-color`가 `mask`로 칠하므로 색이 없다.

**모양** 번개 한 줄기 — 지그재그 실루엣. 12×12 픽셀 격자 × 16 — 얇은 선 금지(R-33), 형태가 뜻을 든다.

**생성** `node art/_src/tokens/gen.mjs` — GPT-image가 아니라 **결정적 비트맵**이다. 12×12 격자가 스크립트 안에 문자열로 살아 있어 다시 돌리면 같은 픽셀이 나온다.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰지 않는다.**

```
magick art/_src/tokens/shock.png -define webp:lossless=true art/tokens/shock.webp
```

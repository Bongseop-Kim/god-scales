# `card-frame.png` — 카드 프레임

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 미생성**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** **1장이면 된다** — 신별 색은 `--zeus`·`--poseidon` 등 CSS 변수가 칠한다(`ui/style.css:100`).

**화면** 카드 한 장이 약 105px, 아트 슬롯이 약 89×67이다. 프레임은 그 바깥 테두리다 — **참고값이다.**

**생성** GPT-image 2.0, `1024×1024`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/ui/card-frame.png -trim +repage -strip art/ui/card-frame.png

# 여백만 자른다. 원본 해상도를 유지하면 고DPI에서 테두리가 흐려지지 않는다
```

**알파가 살아야 한다.** 프레임 안쪽은 완전 투명이어야 카드 아트가 보인다.

## 프롬프트

```text
A single ornate card border frame for a dark fantasy deckbuilding game, drawn as a thin hand-painted band of aged bronze and dark stone running around the edge of a vertical rectangle, with the ENTIRE INTERIOR completely empty and transparent. Slightly heavier at the top and bottom edges, a small notch at the top centre. Restrained and simple, readable at roughly 105 pixels wide.

The frame is a single flat colour band in muted bronze so a colour tint can be applied to it in code. Transparent background, alpha channel, border only, nothing inside the frame, no illustration, no text, no numbers, no gems, no filigree overload, no drop shadow, no glow, no watermark, no photorealism, no 3D render.
```

## 주의

- **신별로 5장을 그리지 않는다.** CSS 변수가 색을 칠하므로 무채색 청동 한 장이면 된다 — 그래서 프레임은 색을 최대한 단순하게 유지한다
- 장식을 늘리면 89px 아트 슬롯을 먹는다. 얇은 띠가 정답이다

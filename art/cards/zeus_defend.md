# `zeus_defend.webp` — 제우스 · 방어 태그

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 완료 · 512×384** · **이 문서는 `gen-docs.mjs`가 덮지 않는 손 작성본이다** — 템플릿은 [`zeus_attack.md`](zeus_attack.md)에서 확정됐다

**파일** WebP **가로 4:3**, **`512×384`.** **카드는 이 계획에서 축소를 허용하는 유일한 자리다**(§3) — 슬롯이 89×67이라 DPR 2에서 178×134이면 되고 512×384가 그것의 2.9배다.

**화면** 약 89×67. 그게 썸네일 가독성 기준이고 **파일 크기 지시가 아니다.**

**생성** GPT-image 2.0, `1536×1024` — 4:3으로 crop한 뒤 512×384로 줄인다(§3)

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/zeus_defend.png -gravity center -crop 1365x1024+0+0 +repage \
  -quality 88 art/cards/zeus_defend.webp
```

## 프롬프트

```text
A single massive slab of a shield wall set at a slight angle across the LOWER HALF of the frame, wide and squat and heavy, filling the frame from left edge to right edge, bracing against something coming from above. One instantly readable horizontal mass, built from a few decisive angular strokes with hard corners. No round shield, no circle, no disc, no scenery, no architecture.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a muted antique gold #d4a017, never bright yellow, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow, no secondary accent color. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **원형 방패를 쓰지 않는다.** 89px에서 금색 구슬로 읽힌다
- 이 태그의 방향은 **가로**다. `attack`은 대각선, `utility`는 빈 고리, `token`은 흩어짐 — 방향이 겹치면 썸네일에서 붙는다
- 신별로는 방패의 재질만 바꾼다: 청동 / 파도 벽 / 성벽 / 갑주 / 나무 방벽

## 통과 기준

```
magick art/cards/zeus_defend.webp -resize 89x67! /tmp/t.png
```

`zeus_attack`과 나란히 놓고 형태가 갈리면 통과. 금색 25% 초과 또는 흰 코어면 재생성.

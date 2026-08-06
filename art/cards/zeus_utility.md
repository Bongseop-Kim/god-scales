# `zeus_utility.webp` — 제우스 · 유틸리티 태그

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 완료 · 512×384** · **이 문서는 `gen-docs.mjs`가 덮지 않는 손 작성본이다** — 템플릿은 [`zeus_attack.md`](zeus_attack.md)에서 확정됐다

**파일** WebP **가로 4:3**, **`512×384`.** **카드는 이 계획에서 축소를 허용하는 유일한 자리다**(§3) — 슬롯이 89×67이라 DPR 2에서 178×134이면 되고 512×384가 그것의 2.9배다.

**화면** 약 89×67. 그게 썸네일 가독성 기준이고 **파일 크기 지시가 아니다.**

**생성** GPT-image 2.0, `1536×1024` — 4:3으로 crop한 뒤 512×384로 줄인다(§3)

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/zeus_utility.png -gravity center -crop 1365x1024+0+0 +repage \
  -quality 88 art/cards/zeus_utility.webp
```

## 프롬프트

```text
A single thick broken ring filling the frame, drawn as a few decisive angular strokes with hard corners, its center completely empty and dark so the shape reads as a hollow circle with a gap in it. Nothing inside the ring, nothing behind it. No orb, no sphere, no filled disc, no scenery, no architecture, no clouds.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a muted antique gold #d4a017, never bright yellow, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow, no secondary accent color. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **가운데가 비어 있는 게 이 태그의 전부다.** 네 태그 중 유일하게 중앙이 어두워 나머지 셋과 완전히 갈린다. 고리 안에 무엇이든 채우면 그 값이 사라진다
- **수직 구도를 쓰지 않는다.** 빛줄기 형태가 되는 순간 `attack`과 썸네일에서 붙는다
- 신별로는 고리의 재질만 바꾼다: 전하 고리 / 소용돌이 / 올리브 관 / 부러진 사슬 / 활 시위

## 통과 기준

```
magick art/cards/zeus_utility.webp -resize 89x67! /tmp/t.png
```

같은 신의 4장을 89×67로 나란히 놓고 형태 넷이 갈리면 통과. 금색 25% 초과 또는 흰 코어면 재생성.

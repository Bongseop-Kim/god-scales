# `ares_attack.webp` — 아레스 · 공격 태그

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 미생성**

**파일** WebP **가로 4:3**, **생성 원본 해상도 유지 — 축소하지 않는다.** `.card-art`가 `aspect-ratio: 4/3` + `object-fit: cover`라 비율만 맞으면 된다 — 세로 2:3으로 그리면 높이의 절반이 잘린다.

**화면** 약 89×67. 그게 썸네일 가독성 기준이고 **파일 크기 지시가 아니다.**

템플릿은 [`zeus_attack.md`](zeus_attack.md)에서 확정됐다. 격자는 둘로만 갈린다 — **태그 = 형태(대각선), 신 = 색.**

**생성** GPT-image 2.0, `1536×1024 — 실제 출력이 1448×1086이면 이미 4:3이라 crop도 생략한다. **어느 쪽이든 축소하지 않는다**`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/ares_attack.png -gravity center -crop 1365x1024+0+0 +repage \
  -quality 88 art/cards/ares_attack.webp
```

용량은 22~31KB에 떨어진다(R-21 기준).

## 프롬프트

```text
A single bold battle axe symbol filling the frame, tearing DIAGONALLY from the top-left corner down to the bottom-right, striking a slab of scorched stone in the lower third and splitting it with a few short cracks. Treat it like a game ability emblem: one instantly readable shape, thick and heavy, built from a few decisive angular strokes with hard corners. No thin lines, no branching filaments, no scenery, no architecture, no clouds. It spans the frame corner to corner and dominates it.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a dark blood red #9b2226, never scarlet, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- `zeus_attack`이 확정본이다 — 형태 문장을 그대로 쓰고 무기와 바닥 재질만 바꿨다
- 방향이 겹치면 썸네일에서 붙는다 — 같은 신의 4장은 대각선 / 가로 / 흩어짐 / 빈 고리로 갈린다
- 통과 기준: **원본은 그대로 두고** `/tmp`에만 깎아 본다 — `magick art/cards/파일 -resize 89x67! /tmp/t.png`. 같은 신의 4장을 나란히 놓고 **형태 넷이 갈리면 통과.** 신 색 면적이 25%를 넘거나 흰 코어가 생기면 재생성

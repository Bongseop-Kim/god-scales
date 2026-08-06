# `artemis_defend.webp` — 아르테미스 · 방어 태그

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 완료 · 512×384 — 이 신은 `godColors`와 **색상 자체**가 달랐다. §3 표의 hex가 정본이고 그것으로 그렸다**

**파일** WebP **가로 4:3**, **`512×384`.** `.card-art`가 `aspect-ratio: 4/3` + `object-fit: cover`라 비율만 맞으면 된다 — 세로 2:3으로 그리면 높이의 절반이 잘린다.

**화면** 약 89×67, DPR 2에서 178×134. 512×384가 그것의 2.9배다 — **카드는 이 계획에서 축소를 허용하는 유일한 자리다**(§3). 배경·컷인·일러는 그대로 원본을 지킨다.

템플릿은 [`zeus_attack.md`](zeus_attack.md)에서 확정됐다. 격자는 둘로만 갈린다 — **태그 = 형태(가로로 넓은 덩어리), 신 = 색.**

**생성** GPT-image 2.0, `1536×1024` — 4:3으로 crop한 뒤 512×384로 줄인다(§3). **카드만 이 축소를 허용한다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/artemis_defend.png -gravity center -crop 1365x1024+0+0 +repage \
  -filter Lanczos -resize 512x384! -quality 88 art/cards/artemis_defend.webp
```

용량은 22~31KB에 떨어진다(R-21 기준) — 실측 30장 평균 17KB, 최대 29KB로 맞았다.

**`art/_src/cards/` 원본은 없다.** 팔레트나 구도를 바꾸려면 재생성밖에 없고, 그 대가를 감수하기로 했다(§3).

## 프롬프트

```text
A single massive barricade of lashed timber and thorn set at a slight angle across the LOWER HALF of the frame, wide and squat and heavy, filling the frame from left edge to right edge, bracing against something coming from above. One instantly readable horizontal mass, built from a few decisive angular strokes with hard corners. No round shield, no circle, no disc, no scenery, no architecture.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a pale muted amethyst #8e7ca6, never violet, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **원형은 쓰지 않는다** — 89px에서 구슬로 읽힌다
- 방향이 겹치면 썸네일에서 붙는다 — 같은 신의 4장은 대각선 / 가로 / 흩어짐 / 빈 고리로 갈린다
- 통과 기준: **원본은 그대로 두고** `/tmp`에만 깎아 본다 — `magick art/cards/파일 -resize 89x67! /tmp/t.png`. 같은 신의 4장을 나란히 놓고 **형태 넷이 갈리면 통과.** 신 색 면적이 25%를 넘거나 흰 코어가 생기면 재생성

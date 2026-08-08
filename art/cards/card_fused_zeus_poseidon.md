# `card_fused_zeus_poseidon.webp` — 해일 벼락 (제우스 + 포세이돈)

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 완료 · 512×384**

**파일** WebP **가로 4:3**, **`512×384`.** 화면이 약 89×67이라 DPR 2의 2.9배다 — **카드만 축소를 허용한다**(§3).

**융합 10장은 폴백 대상이 아니다** — `patron_pair`라 `{patron}_{tag}` 폴백이 걸리지 않으므로 카드별 아트가 필수다.

**생성** GPT-image 2.0, `1536×1024` — 4:3으로 crop한 뒤 512×384로 줄인다(§3). **카드만 이 축소를 허용한다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/card_fused_zeus_poseidon.png -gravity center -crop 1365x1024+0+0 +repage \
  -filter Lanczos -resize 320x240! -quality 80 art/cards/card_fused_zeus_poseidon.webp
```

용량은 22~31KB에 떨어진다(R-21 기준) — 실측 30장 평균 17KB, 최대 29KB로 맞았다.

**`art/_src/cards/` 원본은 없다.** 팔레트나 구도를 바꾸려면 재생성밖에 없고, 그 대가를 감수하기로 했다(§3).

## 프롬프트

```text
A single fused emblem filling the frame: a single thick bolt of gold driving down into the crest of one towering dark wave, the two shapes locking at the point of impact. Treat it like a game ability emblem: one instantly readable shape built from a few decisive angular strokes with hard corners, thick and heavy, no thin lines, no scenery, no architecture, no clouds.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly TWO hues of light in the image and no others, a muted antique gold #d4a017 and a deep desaturated teal #2e7d8f, each holding its own part of the shape and never blending into a third colour, together covering about one third of the frame. Never neon, never white-hot, never a white core, no rainbow. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **융합만 두 색을 쓴다.** 나머지 20장은 「한 신 = 한 색」이 규칙이고, 융합은 그 규칙이 깨지는 것 자체가 사건이다 — 두 색이 섞여 제3의 색이 되면 그 값이 사라진다
- **컷인은 신규 에셋 0이다** — 융합 연출은 신 일러 두 장을 좌우 슬라이드인으로 처리한다(§4)
- 통과 기준: **`/tmp`에만** 89×67로 깎아 두 색이 각각 식별되면 통과. 섞여서 갈색·회색이 되면 재생성 — **원본 파일은 건드리지 않는다**

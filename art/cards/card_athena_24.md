# `card_athena_24.webp` — 반격의 벽 (아테나)

[P-32](../../plans/32-art.md) P-51 · [원본 규칙](../README.md) · **상태 완료 · 320×240**

**파일** WebP **가로 4:3**, **`320×240` q80.** 화면 약 124×93, DPR 2에서 248×186이다.

**생성** GPT-image 2.0, `1536×1024` — 원본 PNG는 `art/_src/cards/`에 보존한다

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/card_athena_24.png -gravity center -crop 1365x1024+0+0 +repage \
  -filter Lanczos -resize 320x240! -quality 80 art/cards/card_athena_24.webp
```

원본과 배포본은 다른 경로다. 장당 10KB를 넘으면 품질을 낮추지 않고 밝은 면적을 줄여 재생성한다.

## 프롬프트

```text
Create a broad squat barrier across the lower half derived literally from the Korean card title “반격의 벽”. Use the title’s concrete object or force as the main motif, and make its silhouette distinct from every other athena card rather than varying only the size or angle.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a dull olive bronze #7a8b5c, never lime, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- 같은 신 카드와 89×67로 나란히 축소했을 때 제목 없이 형태로 구분돼야 한다.

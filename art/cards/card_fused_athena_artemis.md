# `card_fused_athena_artemis.webp` — 달의 아이기스 (아테나 + 아르테미스)

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 **생성 보류** — 아테나·아르테미스 색 정본이 코드에서 확정(`godColors` 삭제)된 뒤다**

**파일** WebP **가로 4:3**, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면은 약 89×67이지만 그건 참고값이다.

**융합 10장은 폴백 대상이 아니다** — `patron_pair`라 `{patron}_{tag}` 폴백이 걸리지 않으므로 카드별 아트가 필수다.

**생성** GPT-image 2.0, `1536×1024` — 실제 출력이 1448×1086이면 crop도 생략한다. **어느 쪽이든 축소하지 않는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/card_fused_athena_artemis.png -gravity center -crop 1365x1024+0+0 +repage \
  -quality 88 art/cards/card_fused_athena_artemis.webp
```

용량은 22~31KB에 떨어진다(R-21 기준).

## 프롬프트

```text
A single fused emblem filling the frame: an olive-bronze aegis shield with a pale amethyst crescent set into its centre as a hollow, the crescent's gap left dark. Treat it like a game ability emblem: one instantly readable shape built from a few decisive angular strokes with hard corners, thick and heavy, no thin lines, no scenery, no architecture, no clouds.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly TWO hues of light in the image and no others, a dull olive bronze #7a8b5c and a pale muted amethyst #8e7ca6, each holding its own part of the shape and never blending into a third colour, together covering about one third of the frame. Never neon, never white-hot, never a white core, no rainbow. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **융합만 두 색을 쓴다.** 나머지 20장은 「한 신 = 한 색」이 규칙이고, 융합은 그 규칙이 깨지는 것 자체가 사건이다 — 두 색이 섞여 제3의 색이 되면 그 값이 사라진다
- **컷인은 신규 에셋 0이다** — 융합 연출은 신 일러 두 장을 좌우 슬라이드인으로 처리한다(§4)
- 통과 기준: **`/tmp`에만** 89×67로 깎아 두 색이 각각 식별되면 통과. 섞여서 갈색·회색이 되면 재생성 — **원본 파일은 건드리지 않는다**

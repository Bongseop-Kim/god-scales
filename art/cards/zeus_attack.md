# `zeus_attack.webp` — 제우스 · 공격 태그

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 완료 · 512×384** · **이 문서는 `gen-docs.mjs`가 덮지 않는 손 작성본이다**

**이 카드가 20장의 템플릿이다.** 89×67 검증을 통과했다 — 금 면적 19%, 흰 코어 없음, 유틸리티와 형태가 갈림.

**파일** WebP **가로 4:3**, **`512×384`.** **카드는 이 계획에서 축소를 허용하는 유일한 자리다**(§3) — 슬롯이 89×67이라 DPR 2에서 178×134이면 되고 512×384가 그것의 2.9배다. `.card-art`가 `aspect-ratio: 4/3` + `object-fit: cover`라 비율만 맞으면 된다 — 세로 2:3으로 그리면 높이의 절반이 잘린다.

**화면** 약 89×67. 그게 썸네일 가독성 기준이고 **파일 크기 지시가 아니다.**

**생성** GPT-image 2.0, `1536×1024` — 4:3으로 crop한 뒤 512×384로 줄인다(§3)

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/zeus_attack.png -gravity center -crop 1365x1024+0+0 +repage \
  -quality 88 art/cards/zeus_attack.webp
```

**[R-21](../../reviews/21-assets.md)의 「장당 22~31KB」가 실측과 맞는다** — 30장 평균 17KB, 최대 29KB다.

## 프롬프트

```text
A single bold thunderbolt symbol filling the frame, tearing DIAGONALLY from the top-left corner down to the bottom-right, striking a slab of dark bronze stone in the lower third and splitting it with a few short cracks. Treat it like a game ability emblem: one instantly readable shape, thick and heavy, built from a few decisive angular strokes with hard corners. No thin lines, no branching filaments, no scenery, no architecture, no clouds. The bolt spans the frame corner to corner and dominates it.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a muted antique gold #d4a017, never bright yellow, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow, no secondary accent color. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 20장으로 늘리는 규칙

격자는 둘로만 갈린다 — **태그 = 형태, 신 = 색.** 소재를 신별로 새로 짜지 않는다.

`attack`은 형태 문장을 그대로 쓰고 **무기만** 바꾼다: 번개 / 삼지창 / 창 / 도끼 / 화살.

| 신 | 색 문장 |
|---|---|
| zeus | `a muted antique gold #d4a017, never bright yellow` |
| poseidon | `a deep desaturated teal #2e7d8f, never cyan` |
| athena | `a dull olive bronze #7a8b5c, never lime` |
| ares | `a dark blood red #9b2226, never scarlet` |
| artemis | `a pale muted amethyst #8e7ca6, never violet` |

**아테나·아르테미스는 아직 그리지 않는다** — §3의 신 색 정본이 코드에서 확정(`ui/app.tsx`의 `godColors` 삭제)된 뒤다. 그 둘만 CSS 변수와 색상 자체가 다르다.

## 통과 기준

**원본은 그대로 두고 `/tmp`에만 깎아 본다.** 출력 경로가 `/tmp`인 것이 이 명령의 핵심이다:

```
magick art/cards/{god}_{tag}.webp -resize 89x67! /tmp/t.png
```

같은 신의 4장을 `/tmp`에서 나란히 놓고 **형태 넷이 갈리면 통과.** 금색 면적이 25%를 넘거나 흰 코어가 생기면 재생성이다.

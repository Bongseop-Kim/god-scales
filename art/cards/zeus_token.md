# `zeus_token.webp` — 제우스 · 토큰 태그

[P-32](../../plans/32-art.md) §3 · [원본 규칙](../README.md) · **상태 미생성** — 템플릿은 [`zeus_attack.md`](zeus_attack.md)에서 확정됐다

**파일** WebP **가로 4:3**, **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 약 89×67. 그게 썸네일 가독성 기준이고 **파일 크기 지시가 아니다.**

**생성** GPT-image 2.0, `1536×1024` — 실제 출력이 1448×1086이면 crop도 생략한다. **어느 쪽이든 축소하지 않는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/cards/zeus_token.png -gravity center -crop 1365x1024+0+0 +repage \
  -quality 88 art/cards/zeus_token.webp
```

## 프롬프트

```text
Five or six small angular shards hanging scattered in mid-air across the frame at different heights, none of them touching, each one a simple hard-edged fragment, the whole spread reading as a scatter rather than a pile or a heap. No stack, no pile, no coins, no altar, no scenery, no architecture.

Composition: horizontal 4:3, edge to edge, no rounded frame, no badge shape, no border, no vignette, no circular container. The shape must stay unmistakable when the image is shrunk to 89 pixels wide.

Style: hand-painted 2D card illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline clearly visible along the entire edge of the main shape. Not a flat vector icon, not a UI icon, not glossy, not a mobile game gacha icon.

Lighting and color: exactly one hue of light in the image, a muted antique gold #d4a017, never bright yellow, covering about one quarter of the frame. Never neon, never white-hot, never a white core, no rainbow, no secondary accent color. The rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture, dark but not empty and not a flat gradient.

Illustration only, no card frame, no text, no numbers, no characters, no people, no hands, no logos, no watermark. No photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **더미로 쌓지 않는다.** 89px에서 동전 더미로 읽혀 「감전 토큰」이 아니라 재화가 된다
- 이 태그의 방향은 **흩어짐**이다. 하나의 덩어리가 되는 순간 `defend`와 붙는다
- 신별로는 조각의 재질만 바꾼다: 전하 파편 / 물방울 / 청동 조각 / 핏방울 / 화살깃

## 통과 기준

```
magick art/cards/zeus_token.webp -resize 89x67! /tmp/t.png
```

`zeus_attack`·`zeus_defend`와 나란히 놓고 형태가 갈리면 통과. 금색 25% 초과 또는 흰 코어면 재생성.

# `under-combat.png` — 오르는 길 (저승 1~5층 전투 배경)

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · **네 장이 세로/정사각이라 가로로 재생성 대상** (`map-under`·`map-surface`·`surface-boss`·`surface-combat`)**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** 저승 1~5층 전투 · **1차 세트로 픽셀 배율·팔레트·고어 수준이 여기서 굳었다**

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/under-combat.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/under-combat.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로가 나오면 crop으로 고치지 말고 다시 뽑는다.** 1024×1536을 16:10으로 자르면 그림의 절반이 버려진다 — 그게 `map-under`·`map-surface`·`surface-boss`·`surface-combat`에서 실제로 생긴 일이다.

**받은 크기를 먼저 확인한다:** `magick identify -format '%wx%h' art/_src/bg/{name}.png` — 폭이 높이보다 크지 않으면 변환하지 말고 재생성한다.

## 프롬프트

```text
Pixel art environment plate for a grim Greek-mythology roguelike. Wide side-view of the lowest depths of the Underworld: a broken, collapsed stone stairway and cliff face climbing upward out of frame, ledges of cracked black rock. Lower right, the black river Styx pooling between the rocks. Along the left and right edges, the corpses of those who failed the climb, half-fused into the stone, losing their shape, arms submerged in the river, a body hanging from a hook.

Light: the upper edge of the image holds ONE single thin faint pale line of light, the only light source, very dim and narrow; everything below fades into near-black darkness. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: the entire central area must stay dark, empty and quiet with no detail and no bright contrast, all detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure.

Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, cold gray-blue, ash gray, bone white, dead brown, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- **이 한 장이 나머지 다섯 장의 기준이다.** 1차 세트로 픽셀 배율 3배·팔레트·고어 수준이 여기서 굳었으니 다시 뽑을 때 이 장에 맞춘다
- **위쪽 빛 한 줄이 §0.4의 상승 전체를 짊어진다.** 1층이 밑바닥이고 12층이 끝이라 여기가 가장 어둡고 빛이 가장 가늘다 — 밝게 그리면 여섯 장의 기울기가 무너진다
- 1~5층 다섯 층이 이 한 장을 쓴다. 화면에 가장 오래 뜨는 배경이라 중앙이 조용해야 패널 글자가 산다

# `surface-boss.png` — 지상의 문 (12층 아르고스)

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · **네 장이 세로/정사각이라 가로로 재생성 대상** (`map-under`·`map-surface`·`surface-boss`·`surface-combat`)**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** 12층 보스전

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/surface-boss.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/surface-boss.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로가 나오면 crop으로 고치지 말고 다시 뽑는다.** 1024×1536을 16:10으로 자르면 그림의 절반이 버려진다 — 그게 `map-under`·`map-surface`·`surface-boss`·`surface-combat`에서 실제로 생긴 일이다.

**받은 크기를 먼저 확인한다:** `magick identify -format '%wx%h' art/_src/bg/{name}.png` — 폭이 높이보다 크지 않으면 변환하지 말고 재생성한다.

## 프롬프트

```text
Pixel art environment plate for a grim Greek-mythology roguelike. The gate to the surface world, raised by Olympos: a towering doorway made of light itself, its frame carved marble and bronze, standing closed at the top of a short flight of steps. Heaped at the foot of the steps are the remains of everyone who reached this far before, armour and bones and offerings; the soldier is not the first.

Light: THE GATE ITSELF IS THE LIGHT, the brightest thing in the whole six-plate set, the point every previous plate's thin seam of light was pointing toward. Its glow stays contained to the gate and the steps and does not wash across the frame. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: the gate sits in the upper middle but its brightest area must stay narrow so panel text remains readable; the central area stays low-contrast, all detail and all remains are pushed to the left and right thirds and the bottom edge. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no guardian figure, no player figure.

Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- **여섯 장의 빛이 여기로 수렴한다.** 이 한 장이 밝지 않으면 앞의 다섯 장이 그린 상승이 결말을 못 받는다
- 아르고스를 배경에 그리지 않는다 — 스프라이트가 문 앞에 선다
- **빛을 넓게 퍼뜨리면 패널 글자를 잡아먹는다.** 문 자체에만 가두고 좌우로 흘리지 않는다

# `surface-combat.png` — 무너진 올림포스 신전 (지상 7~11층)

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · **네 장이 세로/정사각이라 가로로 재생성 대상** (`map-under`·`map-surface`·`surface-boss`·`surface-combat`)**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** 지상 7~11층 전투

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/surface-combat.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/surface-combat.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로가 나오면 crop으로 고치지 말고 다시 뽑는다.** 1024×1536을 16:10으로 자르면 그림의 절반이 버려진다 — 그게 `map-under`·`map-surface`·`surface-boss`·`surface-combat`에서 실제로 생긴 일이다.

**받은 크기를 먼저 확인한다:** `magick identify -format '%wx%h' art/_src/bg/{name}.png` — 폭이 높이보다 크지 않으면 변환하지 말고 재생성한다.

## 프롬프트

```text
Pixel art environment plate for a grim Greek-mythology roguelike. A ruined temple of Olympos on open ground: toppled marble columns lying across the frame, a collapsed portico, votive offerings left where they fell and rotted in place. Dried blood on the marble, smashed devotional statues. This is the first open sky the soldier has ever seen.

Light: the ENTIRE upper portion of the frame is sky, pale and overcast, far brighter than any Underworld plate. On the far horizon, small and centred low, stands ANOTHER GATE, a distinct silhouette of a doorway of light, foreshadowing floor 12. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: the central area must stay darker, quieter and lower-contrast than the edges so panel text stays readable over it; all fine detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure.

Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- **지평 저 끝의 또 하나의 문이 12층 예고다.** 작게, 중앙 아래쪽에 — 크게 그리면 `surface-boss`와 겹친다
- 여섯 장이 한 줄의 상승을 그린다. 여기서 위쪽 빛이 처음으로 **하늘 전체**가 된다
- 지상 톤은 금·청동에 대리석 흰색이다. 저채도는 유지한다 — 채도를 올리면 카드가 안 튄다

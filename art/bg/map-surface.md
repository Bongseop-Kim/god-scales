# `map-surface.png` — 지상 경로 선택 배경

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · **네 장이 세로/정사각이라 가로로 재생성 대상** (`map-under`·`map-surface`·`surface-boss`·`surface-combat`)**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** `MapScreen` 지상 구간 (7~12층)

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/map-surface.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/map-surface.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로가 나오면 crop으로 고치지 말고 다시 뽑는다.** 1024×1536을 16:10으로 자르면 그림의 절반이 버려진다 — 그게 `map-under`·`map-surface`·`surface-boss`·`surface-combat`에서 실제로 생긴 일이다.

**받은 크기를 먼저 확인한다:** `magick identify -format '%wx%h' art/_src/bg/{name}.png` — 폭이 높이보다 크지 않으면 변환하지 말고 재생성한다.

## 프롬프트

```text
Pixel art environment plate: a WIDE view of a ruined mountain road above ground, seen as a map backdrop. Broken temple steps and switchback paths cut back and forth ACROSS the full width of the frame as they climb, three separate routes distinguishable through the fallen masonry. Toppled columns and abandoned offerings mark the levels already passed. The switchbacks run left and right across a wide frame — that is what keeps the climb inside a landscape shape.

Light: the frame gets steadily brighter toward the TOP, and near the top edge, small and backlit, stands the silhouette of the gate to the surface. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: a large panel is laid over the middle of this image, so the central area must stay dark, quiet and free of fine detail; all detail goes to the left and right thirds. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure, no icons, no map markers, no connecting lines, no text.

Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- `map-under`와 **한 화면에 나란히 축소되어 들어간다**(`.map-columns`). 두 장의 톤과 밝기 기울기가 이어져야 한다
- 맨 위의 지상의 문 실루엣이 `surface-boss`와 같은 문이다 — 형태를 맞춘다
- **갈래 이름 아이콘을 그리지 않는다** — `laneName`이 「왼쪽·가운데·오른쪽」이고 위치가 곧 이름이다

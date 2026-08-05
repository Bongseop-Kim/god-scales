# `map-surface.png` — 지상 경로 선택 배경

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 복구됨 · 가로/세로 방향 확인 필요**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** `MapScreen` 지상 구간 (7~12층)

**생성** GPT-image 2.0, `1536×1024 — **가로로 뽑는다**`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/map-surface.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/map-surface.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로로 생성된 것은 방향이 틀렸다.** 배경은 화면을 꽉 채우는 16:10이라 가로로 다시 뽑는다.

## 프롬프트

```text
Pixel art vertical cross-section of a mountain road above ground, seen as a map backdrop. Ruined temple steps and switchback paths climb from the bottom of the frame toward the top, three separate routes distinguishable through the broken masonry. Fallen columns and abandoned offerings mark the levels already passed.

Light: the frame gets steadily brighter toward the TOP, and at the very top stands the silhouette of the gate to the surface, small and backlit. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: a large panel is laid over the middle of this image, so the central area must stay dark, quiet and free of fine detail; all detail goes to the left and right thirds. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure, no icons, no map markers, no connecting lines, no text.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- `map-under`와 **한 화면에 나란히 축소되어 들어간다**(`.map-columns`). 두 장의 톤과 밝기 기울기가 이어져야 한다
- 맨 위의 지상의 문 실루엣이 `surface-boss`와 같은 문이다 — 형태를 맞춘다
- **갈래 이름 아이콘을 그리지 않는다** — `laneName`이 「왼쪽·가운데·오른쪽」이고 위치가 곧 이름이다

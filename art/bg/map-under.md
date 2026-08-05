# `map-under.png` — 저승 경로 선택 배경

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 복구됨 · 가로/세로 방향 확인 필요**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** `MapScreen` 저승 구간 (1~6층)

**생성** GPT-image 2.0, `1536×1024 — **가로로 뽑는다**`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/map-under.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/map-under.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로로 생성된 것은 방향이 틀렸다.** 배경은 화면을 꽉 채우는 16:10이라 가로로 다시 뽑는다.

## 프롬프트

```text
Pixel art vertical cross-section of a cliff face inside the Underworld, seen as a map backdrop. The bottom of the frame is pure darkness; the rock walls narrow as they rise, and three separate broken paths are visible threading upward through the stone, distinguishable as three routes. Remains of those who took the wrong path are lodged in the rock here and there.

Light: the frame gets steadily brighter toward the TOP, ending in a narrow seam of light where the walls almost meet, the gate crack far above. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: a large panel is laid over the middle of this image, so the central area must stay dark, quiet and free of fine detail; all detail goes to the left and right thirds. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure, no icons, no map markers, no connecting lines, no text.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, cold gray-blue, ash gray, bone white, dead brown, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- P-27에서 지도가 **지역당 6층 × 3갈래 격자**가 됐다. 세 갈래가 갈라진 길로 보여야 한다
- `MapPanel`이 위에서 아래로 6층 → 1층을 깐다 — 「오르는 방향과 화면 방향이 같다」. **밝기 기울기가 화면 위쪽으로 간다**
- **노드 아이콘·연결선·마커를 그리지 않는다.** 아이콘은 P-33 벡터, 연결선은 CSS 의사요소, 마커는 `art/ui/marker.png`다
- 결과 화면은 `.map-columns`가 저승·지상 두 장을 **나란히** 놓는다 — `map-surface`와 톤이 이어져야 한다

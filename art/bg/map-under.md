# `map-under.png` — 저승 경로 선택 배경

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · **네 장이 세로/정사각이라 가로로 재생성 대상** (`map-under`·`map-surface`·`surface-boss`·`surface-combat`)**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** `MapScreen` 저승 구간 (1~6층)

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/map-under.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/map-under.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로가 나오면 crop으로 고치지 말고 다시 뽑는다.** 1024×1536을 16:10으로 자르면 그림의 절반이 버려진다 — 그게 `map-under`·`map-surface`·`surface-boss`·`surface-combat`에서 실제로 생긴 일이다.

**받은 크기를 먼저 확인한다:** `magick identify -format '%wx%h' art/_src/bg/{name}.png` — 폭이 높이보다 크지 않으면 변환하지 말고 재생성한다.

## 프롬프트

```text
Pixel art environment plate: a WIDE cutaway of a cliff wall deep inside the Underworld, seen as a map backdrop. The rock face spans the entire width of the frame, its lower band sunk in pure darkness, and THREE separate broken paths thread up through the stone side by side, clearly three distinct routes with gaps of bare rock between them. Remains of those who took the wrong path are lodged in the rock here and there. The climb is read as three routes across a wide wall, not as one tall shaft.

Light: the frame gets steadily brighter toward the TOP, ending in a narrow seam of light along the upper edge where the rock almost closes, the gate crack far above. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: a large panel is laid over the middle of this image, so the central area must stay dark, quiet and free of fine detail; all detail goes to the left and right thirds. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no player figure, no icons, no map markers, no connecting lines, no text.

Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, cold gray-blue, ash gray, bone white, dead brown, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- P-27에서 지도가 **지역당 6층 × 3갈래 격자**가 됐다. 세 갈래가 갈라진 길로 보여야 한다
- `MapPanel`이 위에서 아래로 6층 → 1층을 깐다 — 「오르는 방향과 화면 방향이 같다」. **밝기 기울기가 화면 위쪽으로 간다**
- **노드 아이콘·연결선·마커를 그리지 않는다.** 아이콘은 P-33 벡터, 연결선은 CSS 의사요소, 마커는 `art/ui/marker.png`다
- 결과 화면은 `.map-columns`가 저승·지상 두 장을 **나란히** 놓는다 — `map-surface`와 톤이 이어져야 한다

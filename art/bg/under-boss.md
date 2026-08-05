# `under-boss.png` — 저승의 문 (6층 케르베로스)

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 원본 해상도 복구됨 · 가로/세로 방향 확인 필요**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**어디에** 6층 보스전

**생성** GPT-image 2.0, `1536×1024 — **가로로 뽑는다**`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/bg/under-boss.png -gravity center -crop 1536x960+0+0 +repage \
  art/bg/under-boss.png
```

**구도 crop까지만 한다.** `-resize`·`-colors`를 걸지 않는다 — 색 감축은 픽셀 배율을 실제로 붙일 때 빌드가 맡는다.

**세로로 생성된 것은 방향이 틀렸다.** 배경은 화면을 꽉 채우는 16:10이라 가로로 다시 뽑는다.

## 프롬프트

```text
Pixel art environment plate for a grim Greek-mythology roguelike. The gate of the Underworld seen from the INSIDE: a huge closed bronze double door filling the upper middle distance, barred shut against the viewer. The floor before it is a bone yard of everyone who failed to pass, skulls and ribs heaped up the walls. Deep gouges and claw-marks scored into the bronze. Something hangs from a hook to one side.

Light: a thin seam of pale light LEAKS through the crack between the two doors and along their top edge, close enough to reach and still blocked. That seam is the only light in the frame. the line of light must fade out before reaching the left and right edges, it must not touch them; no horizontal border line, no frame

Composition: the entire central area must stay dark, quiet and low-contrast with no fine detail, all detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep an empty margin of about 12 grid-pixels, roughly 2.5% of the image width, on all four edges. No characters, no monsters, no dog, no player figure.

Style: pixel art on a 480x300 grid, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, cold gray-blue, ash gray, bone white, dead brown, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

## 주의

- **빛이 문틈으로 새는 게 이 배경의 전부다.** 닿을 만큼 가까운데 막혀 있다 — 6층이 저승의 문이고 12층이 지상의 문이라는 두 문 구조의 앞쪽이다
- 케르베로스를 배경에 그리지 않는다 — 스프라이트가 그 자리에 선다
- **중앙 1040px은 패널이 86% 덮는다.** 좋은 디테일을 중앙에 두면 안 보이고, 대비가 강하면 패널 글자를 잡아먹는다

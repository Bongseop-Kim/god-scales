# `under-combat.png` — 오르는 길 (저승 1~5층 전투 배경)

[P-32](../../plans/32-art.md) §2 · [원본 규칙](../README.md) · **상태 완료**

**파일** PNG, 알파 없음. **생성 원본 해상도 유지 — 축소하지 않는다**.

**화면** 1440×900. CSS가 480×300 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**생성** 내장 ImageGen, 원본 크기 명시 없음.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
cp art/_src/bg/under-combat.png art/bg/under-combat.png
```


## 프롬프트

```text
Pixel art environment plate for a grim Greek-mythology roguelike. Wide side-view of the lowest depths of the Underworld: a broken, collapsed stone stairway and cliff face climbing upward out of frame, ledges of cracked black rock. Lower right, the black river Styx pooling between the rocks. Along the left and right edges, the corpses of those who failed the climb, half-fused into the stone, losing their shape, arms submerged in the river, a body hanging from a hook. The upper edge of the image holds one single thin faint pale line of light, the only light source, very dim and narrow; everything below fades into near-black darkness.

Composition: the entire central area must stay dark, empty and quiet with no detail and no bright contrast, all detail and all gore is pushed to the left and right thirds and the top and bottom edges. Keep a generous empty margin on all four edges. No characters, no monsters, no player figure.

Style: pixel art, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outlines, strictly limited palette of about 24 heavily desaturated colors, cold gray-blue, ash gray, bone white, dead brown, with a single high-saturation blood red used on only a few pixels. Darkest Dungeon style ink darkness and heavy shadow, oppressive dark-fantasy horror mood. No neon, no glow bloom, no lens effects, no text, no UI, no watermark, no signature.
```

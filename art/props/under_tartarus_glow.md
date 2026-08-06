# `under_tartarus_glow.png` — 타르타로스 붉은 균열 빛

[P-32](../../plans/32-art.md) §2 프롭 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · 안 늦었다**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 96px. CSS가 32×32 격자를 3배 확대한 크기다 — **구도용 참고값이고 파일 크기 지시가 아니다.** 배경과 `.shell` 사이 레이어(`z-index: -1`).

**정지 이미지 1장이다. 애니메이션 프레임을 그리지 않는다** — 움직임은 CSS `transform` 루프다.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/props/under_tartarus_glow.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/props/under_tartarus_glow.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다 — 알파 경계가 뭉개지면 화면에서 사각형으로 보인다.

## 프롬프트

```text
A jagged crack in black rock with a dull red glow coming up out of it from below, the light contained inside the crack and its immediate edges. The only saturated colour in the Underworld palette. No flames, no embers, no lava flow, no sparks.

Style: pixel art sprite, single object centered on a fully transparent background, side-on three-quarter view, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **저승에서 유일하게 채도가 높은 프롭이다.** 여러 개 배치하면 그 값이 사라진다 — 화면에 하나둘
- 타르타로스는 아래다 — 빛이 **아래에서** 올라온다. 위쪽 빛과 방향이 반대라 상승 구조를 거든다

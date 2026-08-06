# `under_river_glint.png` — 강물 반짝임

[P-32](../../plans/32-art.md) §2 프롭 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · 안 늦었다**

**파일** PNG 알파. `under_river_glint_idle_1.png`~`under_river_glint_idle_4.png`는 각각 `896×1024`, `under_river_glint.png`는 4프레임 가로 스트립 `3584×1024`다.

**화면** 48px. CSS가 16×16 격자를 3배 확대한 크기다 — **구도용 참고값이고 파일 크기 지시가 아니다.** 배경과 `.shell` 사이 레이어(`z-index: -1`).

**idle 4프레임 루프다.** 재생 속도는 4fps이며 각 프레임의 위치와 캔버스가 고정된다.

**생성** `sprite-gen` component-row 파이프라인, YCbCr 크로마 제거, 고정 팔레트, 투명 RGBA PNG

**기존 원본 변환 기록(참고 전용)** — 현재 원본은 `art/_src/props/under_river_glint-base.png`, 재현 가능한 run은 `art/_src/sprite-runs/under_river_glint/`에 있다.

```
magick art/_src/props/under_river_glint.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/props/under_river_glint.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다 — 알파 경계가 뭉개지면 화면에서 사각형으로 보인다.

## 프롬프트

```text
A single narrow horizontal glint of light on the surface of black water, a thin broken streak with a slightly brighter core, nothing else in the frame. No wave, no splash, no reflection of any object.

Style: pixel art sprite, single object centered on a fully transparent background, side-on three-quarter view, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- 스틱스 수면에 깔린다. 세로로 길면 물이 아니라 빛줄기로 읽힌다
- **움직이는 방향이 스토리다.** 저승 프롭은 **아래로** 흐르고 지상 프롭은 **위로** 뜬다 — 병사만 위로 간다. 같은 프롭 한 장으로 CSS 방향만 뒤집으면 되므로 에셋이 늘지 않는다

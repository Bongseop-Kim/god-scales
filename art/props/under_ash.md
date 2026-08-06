# `under_ash.png` — 재·먼지 낙하

[P-32](../../plans/32-art.md) §2 프롭 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · 안 늦었다**

**파일** PNG 알파. `under_ash_idle_1.png`~`under_ash_idle_4.png`는 각각 `896×1024`, `under_ash.png`는 4프레임 가로 스트립 `3584×1024`다.

**화면** 24px. CSS가 8×8 격자를 3배 확대한 크기다 — **구도용 참고값이고 파일 크기 지시가 아니다.** 배경과 `.shell` 사이 레이어(`z-index: -1`).

**idle 4프레임 루프다.** 재생 속도는 4fps이며 각 프레임의 위치와 캔버스가 고정된다.

**생성** `sprite-gen` component-row 파이프라인, YCbCr 크로마 제거, 고정 팔레트, 투명 RGBA PNG

**기존 원본 변환 기록(참고 전용)** — 현재 원본은 `art/_src/props/under_ash-base.png`, 재현 가능한 run은 `art/_src/sprite-runs/under_ash/`에 있다.

```
magick art/_src/props/under_ash.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/props/under_ash.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다 — 알파 경계가 뭉개지면 화면에서 사각형으로 보인다.

## 프롬프트

```text
A sparse cluster of falling ash and dust, only a few irregular pale grey flecks drifting downward, isolated with generous empty space between them. No smoke cloud, no flame, no scenery.

Style: pixel art sprite, single object centered on a fully transparent background, side-on three-quarter view, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- 가장 많이 뜨는 프롭이다 — 화려하면 안 된다. 회색 점 몇 개가 정답이다
- 화면에서는 24px로 뜬다 — 점이 많으면 그 크기에서 얼룩 하나로 뭉친다
- **움직이는 방향이 스토리다.** 저승 프롭은 **아래로** 흐르고 지상 프롭은 **위로** 뜬다 — 병사만 위로 간다. 같은 프롭 한 장으로 CSS 방향만 뒤집으면 되므로 에셋이 늘지 않는다

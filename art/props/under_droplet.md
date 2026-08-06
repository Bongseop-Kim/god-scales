# `under_droplet.png` — 스틱스 물방울

[P-32](../../plans/32-art.md) §2 프롭 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · 안 늦었다**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 24px. CSS가 8×8 격자를 3배 확대한 크기다 — **구도용 참고값이고 파일 크기 지시가 아니다.** 배경과 `.shell` 사이 레이어(`z-index: -1`).

**정지 이미지 1장이다. 애니메이션 프레임을 그리지 않는다** — 움직임은 CSS `transform` 루프다.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/props/under_droplet.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/props/under_droplet.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다 — 알파 경계가 뭉개지면 화면에서 사각형으로 보인다.

## 프롬프트

```text
A single falling droplet of black river water, one teardrop shape narrower at the top and wider at the bottom, dark blue-grey with one small highlight at its upper edge, isolated in empty space. No splash, no ripple, no water surface, no scenery.

Style: pixel art sprite, single object centered on a fully transparent background, side-on three-quarter view, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- 강물에서 튀어 아래로 흐른다
- 화면에서는 24px로 뜬다 — 눈물 모양과 위쪽 하이라이트 하나가 그 크기에서 남는 전부다
- **움직이는 방향이 스토리다.** 저승 프롭은 **아래로** 흐르고 지상 프롭은 **위로** 뜬다 — 병사만 위로 간다. 같은 프롭 한 장으로 CSS 방향만 뒤집으면 되므로 에셋이 늘지 않는다

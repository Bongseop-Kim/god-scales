# `under_flies.png` — 파리 떼 (에우리노모스 주변)

[P-32](../../plans/32-art.md) §2 프롭 · [원본 규칙](../README.md) · **상태 원본 해상도 그대로 · 안 늦었다**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 24px. CSS가 8×8 격자를 3배 확대한 크기다 — **구도용 참고값이고 파일 크기 지시가 아니다.** 배경과 `.shell` 사이 레이어(`z-index: -1`).

**정지 이미지 1장이다. 애니메이션 프레임을 그리지 않는다** — 움직임은 CSS `transform` 루프다.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/props/under_flies.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/props/under_flies.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다 — 알파 경계가 뭉개지면 화면에서 사각형으로 보인다.

## 프롬프트

```text
A small swarm of carrion flies, four or five tiny black specks scattered at IRREGULAR spacing in empty space, no two the same distance apart. Nothing else in the frame. No insect anatomy, no wings drawn, no scenery, no corpse.

Style: pixel art sprite, single object centered on a fully transparent background, side-on three-quarter view, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **파리 떼와 매달린 사슬이 저승의 고어를 「움직이는 것」으로 만든다** — 정지 배경만으로는 안 나오는 값이다
- 에우리노모스가 시체를 먹는 악령이라는 설정에 붙는다 — 그 적이 뜨는 조우에서 밀도를 올린다
- **점을 규칙적으로 놓으면 패턴으로 읽혀 벌레가 아니게 된다.** 간격이 다 달라야 한다

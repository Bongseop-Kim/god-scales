# `enemy_under_brute.png` — 시체먹는 에우리노모스

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 일부만 생성됨 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 brute HP40 · 16딜 분노. **입이 실루엣의 중심이다.**

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_brute.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_under_brute.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
Eurynomos, the corpse-eating demon of the Underworld who strips the dead down to bone. A hunched gaunt ghoul with flesh the blue-grey of a carrion fly, filling the whole canvas edge to edge. Its open mouth is the centre of the silhouette, jaw distended far too wide, and it is throwing its whole body FORWARD to bite. Long thin arms trailing behind, distended belly, teeth. A few pixels of saturated blood red at the mouth only.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **움직이는 것을 먹는다** — 32px를 꽉 채우는 유일한 일반 적이다. 몸을 앞으로 던지는 자세
- 핏빛 3픽셀은 입가에만. 그 몇 픽셀이 유일한 고채도 색이라 시선이 정확히 거기로 간다
- 살빛이 파리처럼 푸르다는 원전 속성이 팔레트를 정한다 — 다른 저승 적과 색으로도 갈린다

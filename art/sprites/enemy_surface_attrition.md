# `enemy_surface_attrition.png` — 사자 가죽의 파수병

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 일부만 생성됨 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 attrition HP40 · 경화 8. **경화 8이 그 가죽이다.**

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_surface_attrition.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_surface_attrition.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
A heavy infantry guard wearing the pelt of the Nemean lion, whose hide no weapon can pierce. The lion's head is worn as a hood over the helmet, jaws framing the face; the pelt hangs down over the body like plate. It only stands and blocks the road, a rigid vertical silhouette, arms hanging heavy, spear held upright and unused. Dull gold and aged bronze, chalky marble white.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **`enemy_under_attrition`(레테의 익사자)의 리스킨이다.** 같은 캔버스·실루엣·포즈·프레임 타이밍을 쓰고 불어터진 살 → 사자 가죽으로 팔레트와 장비 몇 픽셀만 바꾼다. 익사자를 먼저 확정한다
- **길을 막고 서 있기만 한다** — 공격 자세를 주면 켄타우로스와 역할이 흐려진다
- 지역 톤이 갈린다: 저승은 회청색·뼈색, 지상은 금·청동에 대리석 흰색. 둘 다 저채도다

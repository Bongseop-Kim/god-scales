# `enemy_surface_support.png` — 타락한 니케

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 일부만 생성됨 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 support HP35 · 아군 힐·광란. **유일한 비행 실루엣이다.**

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_surface_support.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_surface_support.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
Nike, goddess of victory, gone rotten. A winged female figure hovering clear of the ground, the ONLY airborne silhouette in the set, gold leaf flaking off her skin in patches, wings half-decayed with feathers missing. Her body is turned LEFT toward the soldier but the battered trumpet is raised back over her shoulder to the RIGHT, sounding victory for her own side only, never for him. Refuses to acknowledge the soldier's victory. Dull gold, aged bronze, chalky white.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **유일한 비행 실루엣이다.** 발이 땅에 닿으면 그 값이 사라진다 — 아래에 여백을 남긴다
- 자기 편에만 승리를 나눠 준다 — 힐·광란 부여가 그 그림이다. 나팔이 병사를 향하지 않아야 한다
- 금박이 벗겨진 몸이 「타락한」의 그림이다. 새 금색을 칠하면 지상 파수병들과 구별이 흐려진다

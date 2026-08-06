# `enemy_surface_boss.png` — 잠들지 않는 아르고스 (12층 보스)

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 적 14 · 진노 신 5 · 주인공 생성 완료 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 144×144. CSS가 48×48 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 + **attack 2프레임**(보스 2종만 받는다).

역할 boss HP190 · 24딜 · 결계 2. **`ward` 2가 「잠들지 않음」 그 자체다.** 아트는 수치를 그대로 받는다.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_surface_boss.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_surface_boss.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
Argos Panoptes, the hundred-eyed watchman of Hera who never sleeps, set before the gate to the surface by Olympos. A TALL vertical humanoid giant, much taller than wide, standing upright and looking DOWN AND TO THE LEFT at the soldier. Its entire body, torso, arms and shoulders, is studded with eyes rendered as dense one- and two-pixel dots, packed close so the density itself reads as a hundred rather than any countable number. Every eye is open. Bronze-toned skin, a staff held upright, no helmet.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **눈 백 개는 세지 말고 밀도로 그린다.** 정확한 수를 맞추려 하면 몸 형태가 사라진다
- **세로로 높은 실루엣이 목적이다.** 케르베로스가 가로로 넓으니 두 보스가 반대로 갈려야 한다
- 올림포스가 지상의 문 앞에 세웠다 — 「신들이 제멋대로 막는다」의 결말이라 위에서 내려다보는 자세다

# `enemy_under_zealot.png` — 마르시아스의 고행자

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 일부만 생성됨 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 zealot HP35 · 8딜 앙심. **앙심 1이 벗겨진 가죽 그 자체다.**

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_zealot.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_under_zealot.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
A follower of Marsyas, the satyr flayed alive by Apollo. A flayed body, all muscle and exposed sinew, wearing its OWN removed skin draped over its shoulders like a cloak. Goat legs. It stands in a posture of offering, arms slightly open, welcoming the punishment. It has come to love the pain. Blood red used on only two or three pixels at the shoulders where the skin hangs.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **`enemy_surface_zealot`(마이나스)과 골격을 공유한다.** 가죽 벗겨진 몸 ↔ 맨몸. 이쪽을 먼저 그린다
- **고어의 정점이자 32px에서 실루엣만으로 되는 것.** 내장을 그리려 하면 얼룩이 된다 — 훼손된 실루엣 + 핏빛 2~3픽셀이 한계다
- 도망은 그에게 신을 향한 모욕이다 — 자세가 공격적이지 않고 「제물을 바치는」 쪽이어야 한다

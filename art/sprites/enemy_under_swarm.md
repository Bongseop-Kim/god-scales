# `enemy_under_swarm.png` — 스키아이 떼 (잡몹)

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 적 14 · 진노 신 5 · 주인공 생성 완료 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 72×72. CSS가 24×24 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 swarm HP25 · 3딜. **공격이 3딜뿐인 이유가 그림에 있다** — 죽이려는 게 아니라 붙잡는 것이다.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_swarm.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_under_swarm.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
The Skiai, the nameless shades of the Underworld dead, rendered as ONE clotted mass of ash and maggots rather than a clear body. No face, no recognisable limbs beyond the arms: thin arms reach UPWARD out of the mass from below, grasping, as if trying to be pulled along with someone climbing past. Formless, crumbling, held together by nothing.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **같이 나가려고 매달린다.** 팔이 아래에서 위로 뻗는 게 이 스프라이트의 전부다
- 24×24라 세트에서 유일하게 작다. HP25에 여러 마리 배치되므로 실루엣이 뭉쳐도 된다
- 형체가 없는 게 목적이다 — 얼굴이나 사지를 그리면 다른 적과 구별이 흐려진다

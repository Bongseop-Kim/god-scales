# `enemy_under_guardian.png` — 스파르토이 방패병

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 적 14 · 진노 신 5 · 주인공 생성 완료 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 guardian HP30 · 방벽 부여. **방패가 실루엣의 절반이다.**

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_guardian.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_under_guardian.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
A Spartoi, a warrior grown from a sown dragon's tooth, now only a skeleton still holding its post. It wears the same panoply as the player's soldier but over bare bone, ribs visible behind the shield. A large round bronze-rimmed shield takes up fully half the silhouette, planted and braced; the spear is secondary and held low. It stands and blocks, nothing more. Only an order remains of it.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **`enemy_surface_guardian`(청동 탈로스 파편)과 골격을 공유한다.** 뼈색 → 청동색 팔레트 스왑 + 갈비뼈 자리에 이음새 몇 픽셀. 방패 각도와 idle 흔들림은 그대로 쓴다 — **이 스프라이트를 먼저 확정해야 그쪽이 리스킨으로 끝난다**
- 같은 골격을 쓴 둘은 한 화면에 뜨지 않는다 — `groups`가 `with` 목록을 같은 region 안에서만 묶는다
- **병사의 미래이기도 하다.** 같은 무구를 뼈로 걸치고 있는 게 그 장치다

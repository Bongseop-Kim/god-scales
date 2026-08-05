# `enemy_under_boss.png` — 케르베로스 (6층 보스)

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 재생성 대상**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다**. idle 및 attack 프레임의 기준 원본.

**화면** 144×144. CSS가 48×48 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

역할 HP130 · 18딜. **아트는 수치를 그대로 받는다** — 「보스가 더 세야 한다」는 이 문서의 일이 아니다.

**생성** 내장 ImageGen, 원본 크기 명시 없음. 단색 크로마키 제거 후 PNG로 저장한다.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_boss.png -alpha on -fuzz 35% -transparent '#00ff00' art/sprites/enemy_under_boss.png
```

생성 원본은 축소하지 않는다. 프레임 애니메이션이 필요하면 이 원본을 기준으로 별도 제작한다.

## 프롬프트

```text
Cerberus, the three-headed hound of Hades, guarding a gate with his back to it: the gate is behind him at the RIGHT edge of the frame and all three heads are turned LEFT at the soldier. A massive four-legged beast, the ONLY quadruped in the set, wide and low and heavy, the three heads spread apart horizontally and all facing left so the silhouette is much wider than it is tall. Matted black hide over visible ribs, jaws open, thick strands of drool. A heavy chain collar whose links run off the edge of the frame, bolted to the gate behind him, he cannot leave either. Blocking, not charging.

Style: pixel art sprite, single figure centered on a fully transparent background, full body, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red used very sparingly. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **가로로 넓은 실루엣이 목적이다.** 12층 보스 아르고스는 세로로 높다 — 두 보스가 실루엣으로 반대로 갈려야 한다
- 문을 등지고 있다. 목줄 사슬이 문에 박혀 그도 떠날 수 없다 — 「죽은 자를 못 나가게 막는 개」가 도망치는 병사에게 가장 정확한 장애물이다
- 유일한 4족 대형이라 이 실루엣이 세트에서 겹치지 않는다

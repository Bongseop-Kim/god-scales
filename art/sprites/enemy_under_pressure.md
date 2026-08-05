# `enemy_under_pressure.png` — 복수의 에리니스

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 재생성 대상**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다**. 정지 포즈 1장; 애니메이션 프레임은 별도 작업.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

역할 pressure HP40 · 6/6/12 고조. **채찍 셋이 그 세 수치를 그린다.**

**생성** 내장 ImageGen, 원본 크기 명시 없음. 단색 크로마키 제거 후 PNG로 저장한다.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_pressure.png -alpha on -fuzz 35% -transparent '#00ff00' art/sprites/enemy_under_pressure.png
```

생성 원본은 축소하지 않는다. 프레임 애니메이션이 필요하면 이 원본을 기준으로 별도 제작한다.

## 프롬프트

```text
An Erinys, a Greek Fury, a gaunt winged woman who hunts the guilty without rest. Dry ragged featherless wings spread high, snakes writhing in place of hair, hollow eyes. She holds three whips, and she is diving DOWNWARD and to the LEFT from above, arms and wings raised over the soldier below her on the left, about to fall on him. She treats escape as a crime. Emaciated limbs, torn dark robe.

Style: pixel art sprite, single figure centered on a fully transparent background, full body, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red used very sparingly. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **지상 pressure(켄타우로스 습격자)와 골격을 공유하지 않는다.** 날개 여인 ↔ 4족으로 실루엣이 갈리는 게 목적이다. pressure는 두 지역 모두에서 단독 등장하는(`group_under_pressure_solo`) 첫 대면 상대라, 저승과 지상이 다른 곳이라는 인상을 이 둘이 만든다
- 저승의 적은 **되돌리려 한다** — 위에서 덮치는 자세. 도망이 그들에게는 배신이다
- 셋이 자매라 단독·쌍 등장이 자연스럽다

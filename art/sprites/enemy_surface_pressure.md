# `enemy_surface_pressure.png` — 켄타우로스 습격자

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 적 14 · 진노 신 5 · 주인공 생성 완료 · 원본 해상도 그대로**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** idle 2~4프레임 스트립.

역할 pressure HP40 · 8/8/16. **돌진 셋이 그 세 수치다.**

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_surface_pressure.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_surface_pressure.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다. 프레임 스트립은 이 원본을 기준으로 별도 작업이다 — GPT-image는 스트립을 못 뽑는다.

## 프롬프트

```text
A centaur raider, from the drunken tribe that stormed a wedding feast. Four-legged horse body with a heavy human torso above it, front hooves already coming off the ground at the start of a charge, driving DOWNWARD and to the LEFT at the soldier as if herding prey ahead of it. Crude club or torn banner, no proper armour, matted hide. Dull gold and aged bronze rather than the grey-blue of the Underworld.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, dull gold, aged bronze, chalky marble white, storm gray, with a single high-saturation blood red on no more than a few pixels. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **저승 pressure(복수의 에리니스)와 골격을 공유하지 않는다.** 날개 여인 ↔ 4족으로 실루엣이 갈리는 게 목적이라 공유를 포기한 유일한 쌍이다
- pressure는 두 지역 모두에서 단독 등장하는 첫 대면 상대라, **저승과 지상이 다른 곳이라는 인상을 이 둘이 만든다.** 여기는 아낄 자리가 아니다
- 지상의 적은 **되돌려보내려 한다** — 위에서 내려다보고 밀어낸다. 신들이 풀어놓은 몰이꾼이다

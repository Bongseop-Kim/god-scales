# `enemy_god_zeus.png` — 제우스 (진노)

[P-32](../../plans/32-art.md) §1.5 · [원본 규칙](../README.md) · **상태 미생성**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** **idle 2프레임**(진노는 20조우에 한 번이다).

패시브 `ramp` 고조. **아트는 P-30 §2가 정한 것을 그대로 받는다.** 신 색은 **번개창 끝**에만 2~3픽셀.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_god_zeus.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_god_zeus.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다.

**위를 자르는 것은 여기서 한다.** 프레임을 넘기는 구도는 생성으로 잘 안 나오므로 `-trim` 뒤에 상단을 잘라 실루엣이 테두리를 넘게 만든다 — 크기를 늘리지 않고 규모를 내는 장치다(§1.5).

## 프롬프트

```text
Zeus himself joined to the battle line as an enemy, wrathful. A standing bearded figure with one arm raised straight ABOVE the head gripping a thrown lightning javelin, the only upward-reaching silhouette in the set. Heavy draped himation over one shoulder, bare chest, no helmet, no shield. Looking down and to the LEFT at the soldier while the arm stays up: the blow has not landed yet and grows every turn. The raised hand and the javelin tip are cropped by the top edge of the frame, the figure does not fit inside it.

The body is UNDAMAGED and flawless: no wounds, no missing limbs, no rot, no blood, no gore, nothing torn. Every other figure in this set is mutilated; this one is not.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, aged bronze, chalky marble white, with a single high-saturation accent an antique gold #d4a017 on no more than three pixels and nowhere else in the image. Darkest Dungeon style grim dark-fantasy, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no bloom, no god rays, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **위로 뻗는 실루엣은 이 스프라이트만이다.** 팔을 내리면 `ramp`(매 턴 세진다)가 그림에서 사라진다
- 신 색 2~3픽셀은 **번개창 끝**에만. 몸이나 옷을 금색으로 칠하면 지상 파수병들과 섞인다
- 머리와 든 손이 프레임 위로 잘린다 — 48×48로 키우지 않고 규모를 내는 방법이다

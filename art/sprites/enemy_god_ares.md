# `enemy_god_ares.png` — 아레스 (진노)

[P-32](../../plans/32-art.md) §1.5 · [원본 규칙](../README.md) · **상태 미생성**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면용 축소는 빌드가 맡는다.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.** **idle 2프레임**(진노는 20조우에 한 번이다).

패시브 `spite` 앙심. **아트는 P-30 §2가 정한 것을 그대로 받는다.** 신 색은 **창끝**에만 2~3픽셀.

**생성** GPT-image 2.0, `1024×1536`, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_god_ares.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/enemy_god_ares.png
```

**생성 원본을 축소하지 않는다.** 크로마키를 벗기고 여백을 자르는 것까지만 한다.

**위를 자르는 것은 여기서 한다.** 프레임을 넘기는 구도는 생성으로 잘 안 나오므로 `-trim` 뒤에 상단을 잘라 실루엣이 테두리를 넘게 만든다 — 크기를 늘리지 않고 규모를 내는 장치다(§1.5).

## 프롬프트

```text
Ares himself joined to the battle line as an enemy, wrathful. A standing armoured figure leaning FORWARD AND TO THE LEFT off balance, weight already committed, carrying a single spear and NO shield at all. Full helmet with only the eye slits visible, no face. The whole silhouette tilts forward at a clear angle: he takes the hit to return it. The helmet is cropped by the top edge of the frame.

The body is UNDAMAGED and flawless: no wounds, no missing limbs, no rot, no blood, no gore, nothing torn. Every other figure in this set is mutilated; this one is not.

Style: pixel art sprite, single figure centered on a fully transparent background, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, aged bronze, chalky marble white, with a single high-saturation accent a dark blood red #9b2226 on no more than three pixels and nowhere else in the image. Darkest Dungeon style grim dark-fantasy, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no bloom, no god rays, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **색으로 구별되지 않는 유일한 신이다.** 아레스의 `#9b2226`이 이미 모든 스프라이트의 핏빛 강조색이라, 앞으로 기운 각도와 **방패 없음**이 그 몫을 진다
- 밝은 주홍으로 도망치지 않는다 — §3의 신 색 정본이 흔들리면 카드 20장이 같이 어긋난다
- 앞으로 기운 각도가 `spite`(맞으면 되돌려준다)의 그림이다. 똑바로 서면 아테나와 실루엣이 겹친다

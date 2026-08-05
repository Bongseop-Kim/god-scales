# `player.png` — 깨어난 병사

[P-32](../../plans/32-art.md) §5 · [원본 규칙](../README.md) · **상태 완료**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 포즈별로 한 장씩이고 스트립 조립은 별도 작업이다.

**화면** 96×120. CSS가 32×40 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

**생성** 내장 ImageGen, 원본 크기 명시 없음. 단색 크로마키 제거 후 PNG로 저장한다.

**포즈 9개를 따로 뽑는다** — idle 4 · 공격 2 · 피격 1 · 사망 2. `art/_src/player/{pose}.png`에 생성 해상도 그대로 둔다.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/player/{pose}.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage art/sprites/player_{pose}.png
```

**스트립** `art/sprites/player.png`는 위 순서의 9프레임을 32×40 셀로 정렬한 288×40 PNG다. 포즈 원본은 `art/_src/player/`에 생성 해상도 그대로 남긴다.

## 프롬프트

```text
A lone ancient Greek foot soldier who has just woken at the bottom of the Underworld, standing in a guarded neutral idle pose and FACING RIGHT: he is turned toward the right edge of the frame, head, eyes and sword all pointing right, standing on the left of the battle line and watching the enemies on the right. Chin level, shoulders ready, weight balanced. Ruined armor with one shoulder piece missing entirely, torn linen, caked in grey dirt and ash. Minimal weapons, a short broken sword held low. Weary but unbroken. He is the only living thing here. He carries no scales and no divine symbols.

Style: pixel art sprite, single figure centered on a fully transparent background, full body, side-on three-quarter view FACING RIGHT, turned toward the right edge of the frame, never facing the camera, never facing left, never mirrored, large visible square pixels, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard 1-pixel dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red on no more than a few pixels. Grim dark-fantasy horror, readable purely as a silhouette at very small size. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

**`large visible square pixels`와 `readable at very small size`를 지우지 않는다.** 이 둘이 픽셀 아트를 만드는 문장이고, 화면에서 96×120으로 뜨는 근거다 — 파일을 32×40으로 깎으라는 뜻이 아니다.

## 주의

- **저울을 들리지 않는다.** 저울은 신들이 그를 재는 것이라 타이틀과 UI에 있다 — 그게 제목이 뜻하는 것이다
- 다른 넷보다 세로로 길다. 유일한 아군이라 눈에 걸려야 한다
- **오른쪽을 본다.** 병사는 왼쪽에 서고 적은 오른쪽에 선다(P-32 §1 「방향」) — 9프레임 전부 같은 방향이라 좌우 반전이 없다
- idle은 오른쪽의 적을 경계한다. 공격은 짧은 가로 베기고 **오른쪽으로** 나간다

# `enemy_under_attrition.png` — 레테의 익사자

[P-32](../../plans/32-art.md) §1 · [원본 규칙](../README.md) · **상태 재생성 대상**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다**. 정지 포즈 1장; 애니메이션 프레임은 별도 작업.

**화면** 96×96. CSS가 32×32 격자를 3배 확대한 크기다(`image-rendering: pixelated`) — **구도용 참고값이고 파일 크기 지시가 아니다.**

역할 attrition HP35 · 경화 8. **경화 8이 불어터진 살이다** — 수치가 곧 그림이다.

**생성** 내장 ImageGen, 원본 크기 명시 없음. 단색 크로마키 제거 후 PNG로 저장한다.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/sprites/enemy_under_attrition.png -alpha on -fuzz 35% -transparent '#00ff00' art/sprites/enemy_under_attrition.png
```

생성 원본은 축소하지 않는다. 프레임 애니메이션이 필요하면 이 원본을 기준으로 별도 제작한다.

## 프롬프트

```text
A drowned corpse from the river Lethe, standing upright and blocking the path, one who tried to escape the Underworld before and failed. The body is bloated and waterlogged, the swollen flesh gone hard and rubbery like armor plating, skin split where it has stretched. No eyes, only empty sockets. Water pours off the limbs. It does not attack, it simply stands and endures, a rigid vertical silhouette, arms hanging heavy at its sides.

Style: pixel art sprite, single figure centered on a fully transparent background, full body, side-on three-quarter view FACING LEFT: the figure is turned toward the left edge of the frame with its head, eyes and weapon all pointing left, standing on the right of the battle line and looking across at the soldier on the left. Anything described as forward means toward the left. Never facing the camera, never facing right, never mirrored, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red used very sparingly. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple poses, no sprite sheet, no character turnaround.
```

## 주의

- **`enemy_surface_attrition`(사자 가죽의 파수병)과 골격을 공유한다.** 같은 캔버스·실루엣·포즈·프레임 타이밍을 쓰고 팔레트와 장비 몇 픽셀만 바꾼다 — 불어터진 살 ↔ 사자 가죽. **이 스프라이트를 먼저 확정해야 그쪽이 리스킨으로 끝난다**
- 같은 골격을 쓴 둘은 한 화면에 뜨지 않는다 — `data/enemies.json`의 `groups`가 `with` 목록을 같은 region 안에서만 묶는다. 그게 공유가 안전한 근거다
- 「먼저 나가려다 실패한 선례」라 병사에게 경고로 읽혀야 한다. 눈 없음, 수직으로 버티는 실루엣

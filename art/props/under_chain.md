# `under_chain.png` — 갈고리에 매달린 사슬 (저승 프롭)

[P-32](../../plans/32-art.md) §2 프롭 · [원본 규칙](../README.md) · **상태 완료**

**파일** PNG 알파. `under_chain_idle_1.png`~`under_chain_idle_4.png`는 각각 `896×1024`, `under_chain.png`는 4프레임 가로 스트립 `3584×1024`다. 배경과 `.shell` 사이 레이어(`z-index: -1`).

**화면** 72px. CSS가 24×24 격자를 3배 확대한 크기다 — **구도용 참고값이고 파일 크기 지시가 아니다.**

**idle 4프레임 루프다.** 재생 속도는 4fps이며 사슬 흔들림이 프레임에 포함된다.

**생성** `sprite-gen` component-row 파이프라인, YCbCr 크로마 제거, 고정 팔레트, 투명 RGBA PNG

**기존 원본 변환 기록(참고 전용)** — 현재 원본은 `art/_src/props/under_chain-base.png`, 재현 가능한 run은 `art/_src/sprite-runs/under_chain/`에 있다.

```
magick art/_src/props/under_chain.png -alpha on -fuzz 35% -transparent '#00ff00' art/props/under_chain.png
```

## 프롬프트

```text
A short length of heavy rusted iron chain hanging straight down from a large butcher's hook, swaying object seen alone. A few links, the hook at the top, the bottom link ending in a torn scrap of something that was recently attached to it. No figure, no body, just the chain and the hook.

Style: pixel art sprite, single object centered on a fully transparent background, side-on view, no anti-aliasing, no gradients, flat shading with at most three tones per material, hard dark outline around the whole silhouette, strictly limited palette of about 16 heavily desaturated colors, cold gray-blue, bone white, ash brown, with a single high-saturation blood red used very sparingly. Darkest Dungeon style grim dark-fantasy horror, readable purely as a silhouette. No background, no scenery, no ground, no shadow on the floor, no neon, no glow, no text, no watermark, no multiple objects, no sprite sheet.
```

## 주의

- **파리 떼와 이 사슬이 저승의 고어를 「움직이는 것」으로 만든다** — 정지 배경만으로는 안 나오는 값이다
- 저승 프롭은 **아래로** 흐르고 지상 프롭은 **위로** 뜬다. 병사만 위로 간다 — CSS 방향만 뒤집으면 되므로 에셋이 늘지 않는다
- 망령 불꽃·재 낙하·물방울도 동일하게 생성 원본을 유지한다

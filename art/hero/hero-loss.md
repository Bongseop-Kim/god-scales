# `hero-loss.webp` — 패배 결과 화면 (`result`)

[P-32](../../plans/32-art.md) §5 · [원본 규칙](../README.md) · **상태 1440×900으로 깎인 상태 · 원본 없음 → 재생성 대상**

**파일** WebP, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.

**화면** 1440×900 CSS. 컷인 오버레이와 같은 이유로 **축소가 가장 아픈 자리다** — DPR 2에서 2880×1800이 필요한데 생성 상한이 1536이다.

**주인공이 일러로 나오는 자리는 셋뿐이다** — 전투 화면에는 없다(픽셀이 맡는다).

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/hero/hero-loss.png -gravity center -crop 1536x960+0+0 +repage \
  -quality 90 art/hero/hero-loss.webp
```

알파 없음 — 화면을 채운다. 손실 WebP로 충분하다.

**생성물을 먼저 `art/_src/hero/{name}.png`에 그대로 저장하고 나서 변환한다.** 지금 디스크의 세 장이 1440×900인데 `art/_src/hero/`가 비어 있는 게 이 순서를 건너뛴 결과다.

**변환 후 크기를 확인한다:** `magick identify -format '%wx%h' art/hero/{name}.webp` — 1536×960이어야 한다. 1440×900이면 또 깎인 것이다.

## 프롬프트

```text
A dark hand-painted illustration, the deliberate INVERSION of the victory image. A lone ancient Greek soldier in ruined armour is being dragged DOWNWARD, seen from behind, dozens of thin ashen arms of the nameless dead locked around his ankles and legs pulling him back into the dark. Far above him the light he was climbing toward is receding to a narrow seam.

Composition: horizontal, wide. All meaningful content sits in the UPPER HALF of the frame, because the lower half is fully covered by statistics panels. The soldier is centred, tilted backward, the light small and high.

Style: hand-painted 2D illustration, painterly but restrained, coarse visible brush texture, dominant colour a desaturated warm red #eb887d in the fading light, everything else charcoal and near-black #11131a. No face, no front view, no gore, no text, no logo, no watermark, no UI, no frame, no photorealism, no 3D render, no lens flare.

Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.
```

## 주의

- **패배 일러가 없으면 런의 70%가 아무 그림도 없이 끝난다** (6회차 승률 30.2%). 승리보다 자주 뜨는 화면이다
- `.outcome.loss`가 `#eb887d`다(`ui/style.css:91`) — 지배색을 거기에 맞춘다
- 발목을 잡는 팔들이 스키아이(`enemy_under_swarm`)다 — 「같이 나가려고 매달린다」가 여기서 결말을 받는다
- **고어를 그리지 않는다.** 훼손이 아니라 끌려 내려가는 방향이 이 그림의 내용이다

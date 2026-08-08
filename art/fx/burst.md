# `burst.webp` — 공용 파티클 오버레이

[P-32](../../plans/32-art.md) §4 · [원본 규칙](../README.md) · **상태 1440×900으로 깎인 상태 · 원본 없음 → 재생성 대상**

**파일** WebP **무손실 알파**, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.

**화면** 1440×900 CSS. **여기가 축소가 가장 아픈 자리다** — 화면을 꽉 채우는 그림이라 화소가 그대로 값이고, DPR 2에서는 2880×1800이 필요하다. 생성 상한이 1536이라 그것도 못 채우니 **더 깎지 않는 게 유일한 대책이다.**

`ui/fx.ts`의 `playSprite`가 화면 전체에 얹는다 — **지금 호출부가 없어 선행 코드 작업이 필요하다.**

`favorStage`는 4단계지만 `stage_effects`가 실제로 발동하는 건 `devotion`·`wrath` 둘뿐이다(`core/favor.ts:53`). 컷인도 그 둘만 — calm·anger는 없다.

**생성** GPT-image 2.0, `1536×1024` — **가로로 뽑는다**, 투명 배경 옵션 ON

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/fx/burst.png -alpha set -channel A \
  -fx '((r>0.12)&&(b>0.12)&&(r>g*1.25)&&(b>g*1.25))?0:a' +channel \
  -gravity center -crop 1536x960+0+0 +repage \
  -define webp:lossless=true art/fx/burst.webp
```

**알파가 필요하니 무손실로 저장한다.** 손실 WebP는 알파 경계를 망친다.

**생성물을 먼저 `art/_src/fx/{name}.png`에 그대로 저장하고 나서 변환한다.** 지금 디스크의 세 장이 1440×900인데 `art/_src/fx/`가 비어 있는 게 이 순서를 건너뛴 결과다 — 원본이 없으니 되돌릴 방법이 재생성밖에 없다.

**변환 후 크기를 확인한다:** `magick identify -format '%wx%h' art/fx/{name}.webp` — 1440×900이 나오면 어딘가에서 또 깎인 것이다. 1536×960이어야 한다.

## 프롬프트

```text
A full-screen transparent overlay effect: a scatter of small hard-edged particles and embers thrown outward from the centre of the frame, densest in the middle band and thinning to nothing at the edges. Pale neutral white-grey particles with no colour of their own, varying sizes, no motion blur, no streaks.

The particles must be sparse enough that the game screen stays readable through them, and the very centre must stay clear. The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, effect only, no scenery, no scenery, no characters, no figures, no text, no watermark, no frame, no vignette.
```

## 주의

- **색을 넣지 않는다.** `open`과 `block` 둘 다에 얹혀 세기를 올리는 공용 레이어라 신 색은 코드가 칠한다
- 「화려하게」는 에셋이 아니라 연출이다 — 상징 스윕 → 신 일러 슬라이드인 → 화면 플래시 → 오버레이 → 컬러 그레이드, 5단 전부 WAAPI다
- 입자를 촘촘히 그리면 그 아래 전투 화면이 안 읽힌다. 중앙은 비운다

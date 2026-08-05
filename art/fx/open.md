# `open.webp` — 헌신 컷인 오버레이 (길이 열린다)

[P-32](../../plans/32-art.md) §4 · [원본 규칙](../README.md) · **상태 1440×900으로 깎인 상태 · 원본 없음 → 재생성 대상**

**파일** WebP **무손실 알파**, **생성 원본 해상도 유지 — 축소하지 않는다.** `ui/fx.ts`의 `playSprite`가 화면 전체에 얹는다 — 지금 호출부가 없어 선행 코드 작업이 필요하다.

**화면** 1440×900 CSS. **여기가 축소가 가장 아픈 자리다** — 화면을 꽉 채우는 그림이라 화소가 그대로 값이고, DPR 2에서는 2880×1800이 필요하다. 생성 상한이 1536이라 그것도 못 채우니 **더 깎지 않는 게 유일한 대책이다.**

`favorStage`는 4단계지만 `stage_effects`가 실제로 발동하는 건 `devotion`·`wrath` 둘뿐이다(`core/favor.ts:53`). 컷인도 그 둘만 — calm·anger는 없다.

**생성** 내장 ImageGen, 원본 크기 명시 없음. `#ff00ff` 크로마키 제거 후 PNG·WebP.

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/fx/open.png -alpha set -channel A \
  -fx '((r>0.12)&&(b>0.12)&&(r>g*1.25)&&(b>g*1.25))?0:a' +channel \
  -gravity center -crop 8:5 +repage -define webp:lossless=true art/fx/open.webp
```

**알파가 필요하니 무손실로 저장한다.** 손실 WebP는 알파 경계를 망친다.

## 프롬프트

```text
A full-screen transparent overlay effect: only several shafts of pale divine light splitting apart and pouring DOWNWARD from the very top edge of the frame, widening slightly as they descend, as if a sealed way has just opened from above. The light originates entirely at the top edge and fades out completely before reaching the middle. Soft muted golden-white beams with hard-edged gaps between them, with sparse restrained motes inside the beams.

The center and bottom of the image must be fully transparent and empty so the game screen stays visible beneath it. Wide landscape 16:10 orientation, much wider than tall.

Transparent background, alpha channel, abstract light only. No hand, chains, wall, stone, door, window, sun, clouds, architecture, background, scenery, characters, figures, text, watermark, frame, vignette, bloom, or lens flare.
```

## 주의

- **위에서 내려오는 방향이 핵심이다.** 짝인 `block.webp`(진노)는 **아래로 누르는** 사슬·벽·거대한 손이다. 병사는 위로 가려 하고 진노가 그걸 누른다 — 컷인 한 장이 그 싸움을 말한다
- 빛의 시작점이 화면 상단인 건 §0.4의 「위쪽 빛」과 같은 자리다
- **중앙·하단은 완전 투명이어야 한다.** 뒤의 픽셀 전투 화면이 보여야 「신이 끼어든다」가 성립한다. 병사는 컷인 뒤에 스프라이트로 그대로 서 있다
- **진노용 신 일러를 따로 그리지 않는다** — 붉은 그레이딩 + 글리치 오버레이를 코드가 얹는다

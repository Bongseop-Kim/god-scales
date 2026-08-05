# `block.webp` — 진노 컷인 오버레이 (길이 막힌다)

[P-32](../../plans/32-art.md) §4 · [원본 규칙](../README.md) · **상태 미생성**

**파일** WebP **무손실 알파**, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.

**화면** 1440×900 CSS. **여기가 축소가 가장 아픈 자리다** — 화면을 꽉 채우는 그림이라 화소가 그대로 값이고, DPR 2에서는 2880×1800이 필요하다. 생성 상한이 1536이라 그것도 못 채우니 **더 깎지 않는 게 유일한 대책이다.**

`ui/fx.ts`의 `playSprite`가 화면 전체에 얹는다 — **지금 호출부가 없어 선행 코드 작업이 필요하다.**

`favorStage`는 4단계지만 `stage_effects`가 실제로 발동하는 건 `devotion`·`wrath` 둘뿐이다(`core/favor.ts:53`). 컷인도 그 둘만 — calm·anger는 없다.

**생성** GPT-image 2.0, `1536×1024 (**가로**), 투명 배경 옵션 ON`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/fx/block.png -gravity center -crop 1536x960+0+0 +repage \
  -define webp:lossless=true art/fx/block.webp
```

**알파가 필요하니 무손실로 저장한다.** 손실 WebP는 알파 경계를 망친다.

## 프롬프트

```text
A full-screen transparent overlay effect: heavy chains, a slab of wall and one enormous open hand pressing DOWNWARD from the top of the frame, crossing the image horizontally and bearing down on whatever is beneath. The pressure reads as coming from above and pushing down. Hard-edged dark silhouettes with a thin rim of dull red light along their lower edges, no interior detail.

The lower third and the far left and right edges must be fully transparent and empty so the game screen stays visible beneath it. Wide landscape 16:10 orientation, much wider than tall.

Transparent background, alpha channel, effect only, no background, no scenery, no characters, no figures, no faces, no text, no watermark, no frame, no vignette.
```

## 주의

- **`open.webp`와 방향으로 갈린다.** 헌신은 위에서 갈라지며 내려오는 빛이고 진노는 **아래로 누른다** — 병사는 위로 가려 하고 진노가 그걸 누른다. 컷인 한 장이 그 싸움을 말한다
- **진노용 신 일러를 따로 그리지 않는다** — 붉은 그레이딩 + 글리치 오버레이를 코드가 얹는다
- **컷인에 병사를 넣지 않는다.** 병사는 컷인 뒤에 픽셀 스프라이트로 그대로 서 있고 오버레이가 그 위를 덮는다 — 그게 「끼어든다」의 그림이다

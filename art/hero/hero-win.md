# `hero-win.webp` — 승리 결과 화면 (`result`)

[P-32](../../plans/32-art.md) §5 · [원본 규칙](../README.md) · **상태 미생성**

**파일** WebP, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.

**화면** 1440×900 CSS. 컷인 오버레이와 같은 이유로 **축소가 가장 아픈 자리다** — DPR 2에서 2880×1800이 필요한데 생성 상한이 1536이다.

**주인공이 일러로 나오는 자리는 셋뿐이다** — 전투 화면에는 없다(픽셀이 맡는다).

**생성** GPT-image 2.0, `1536×1024`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/hero/hero-win.png -gravity center -crop 1536x960+0+0 +repage \
  -quality 90 art/hero/hero-win.webp
```

알파 없음 — 화면을 채운다. 손실 WebP로 충분하다.

## 프롬프트

```text
A dark hand-painted illustration. A lone ancient Greek soldier in ruined armour steps THROUGH an open gate of light, seen entirely FROM BEHIND, his silhouette already half dissolved by the brightness swallowing him. The light fills the upper half of the frame completely; the ground he is leaving is dark.

Composition: horizontal, wide. All meaningful content sits in the UPPER HALF of the frame, because the lower half is fully covered by statistics panels. The soldier is centred and small against the gate.

Style: hand-painted 2D illustration, painterly but restrained, coarse visible brush texture, dominant colour a pale desaturated green-white #8fd6a4 in the light, everything else charcoal and near-black #11131a. No face, no front view, no text, no logo, no watermark, no UI, no frame, no photorealism, no 3D render, no lens flare.
```

## 주의

- **`hero-loss`와 한 구도의 반전이라 두 장을 같이 설계한다.** 따로 설계하면 둘 다 약해진다
- `.outcome.win`이 `#8fd6a4`다(`ui/style.css:91`) — 일러의 지배색을 거기에 맞춘다
- **결과 화면은 아래쪽이 이미 붐빈다** — `.summary-grid` 4칸 + `.result-columns` + `.map-columns` 두 지역 격자. 일러는 상단 절반까지만 온다
- 등만 보인다 — 얼굴을 그리면 32×40 스프라이트와 인상이 충돌한다

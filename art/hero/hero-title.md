# `hero-title.webp` — 타이틀 화면 (`.setup`)

[P-32](../../plans/32-art.md) §5 · [원본 규칙](../README.md) · **상태 미생성**

**파일** WebP, **생성 원본 해상도 유지 — 축소하지 않는다.** 가로 16:10.

**화면** 1440×900 CSS. 컷인 오버레이와 같은 이유로 **축소가 가장 아픈 자리다** — DPR 2에서 2880×1800이 필요한데 생성 상한이 1536이다.

**주인공이 일러로 나오는 자리는 셋뿐이다** — 전투 화면에는 없다(픽셀이 맡는다).

**생성** GPT-image 2.0, `1536×1024`

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/hero/hero-title.png -gravity center -crop 1536x960+0+0 +repage \
  -quality 90 art/hero/hero-title.webp
```

알파 없음 — 화면을 채운다. 손실 WebP로 충분하다.

## 프롬프트

```text
A dark hand-painted illustration for a game title screen. At the bottom of a vast underworld shaft, a lone ancient Greek soldier in ruined armour stands looking UPWARD toward a distant light. Behind and above him, filling the upper part of the frame, hangs an enormous pair of scales: in one pan the soldier himself, in the other the hands of gods reaching in to press it down. He is small; the scales are the largest thing in the image.

Composition: horizontal, wide. The UPPER LEFT QUADRANT must be kept dark, quiet and free of important detail, because a very large title headline is laid over it. The soldier sits low and right of centre; the scales occupy the upper right.

Style: hand-painted 2D illustration, painterly but restrained, coarse visible brush texture, heavy shadow, near-black background #11131a with charcoal and deep navy, one narrow shaft of pale light from above as the only light source. Muted and desaturated except that light. No text, no title, no logo, no watermark, no UI, no frame, no photorealism, no 3D render, no bloom, no lens flare.
```

## 주의

- **h1이 최대 6.4rem으로 크게 얹히고 `.setup`이 `justify-items: start`다**(`ui/style.css:19`) — 좌측 상단을 비워 둔다
- **저울은 병사가 들지 않는다.** 신들이 그를 재는 것이라 손이 아니라 타이틀과 UI에 있다 — 그게 제목이 뜻하는 것이다
- 병사가 작아야 한다. 크게 그리면 저울이 배경 장식이 되고 제목의 뜻이 사라진다

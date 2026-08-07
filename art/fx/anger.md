# `anger.webp` — 분노 컷인 오버레이 (4프레임 스트립)

[R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [P-50](../../plans/50-fx-sprites.md) · **상태 스틸 1장 배포 중 — 스트립 미생성**

**기준 원본** `art/_src/fx/anger.png` 1586×992 · **run** `art/_src/sprite-runs/fx_anger/` · **배포본** `art/fx/anger.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 1440×900 CSS 전체를 덮는 컷인. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 P-50 §3.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 크로마 마젠타 `#ff00ff`, YCbCr 크로마 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니라 부드러운 빛이다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot withdrawal: frame 1 the pale light is still present with the first hairline cracks; frames 2 and 3 the light visibly pulls upward and out through the top edge while the cracks widen and sharpen; frame 4 the light is gone and only the jagged cracks remain with their thin dull rim. No downward motion and no impact point in any frame; the lower third and the centre stay completely empty."
}
```

**변환** — 입력은 run의 시트고 출력은 `art/`다.

```
magick art/_src/sprite-runs/fx_anger/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/anger.webp
```

**무손실이 아니다** — 스틸 1장 시절 규칙이었다. 4프레임 스트립은 무손실이 파일당 200KB 상한(`tools/size.ts`)을 깬다. q90 실측이 프레임당 13~36KB라 스트립이 상한 안에 들고, 알파 경계는 `alpha-quality 100`이 지킨다.

## 프롬프트 (기준 프레임)

```text
A full-screen transparent overlay effect: pale neutral light withdrawing UPWARD and OUTWARD out of the frame, leaving behind hard-edged jagged cracks where it has pulled away. The cracks are widest at the top and taper as they descend, and the light is visibly leaving through the top edge rather than entering through it. It reads as a presence turning its back, not as a strike.

Hard-edged fractures with a thin dull rim, no interior detail, no impact point, no downward motion anywhere in the frame. The lower third and the centre must be entirely empty of any effect.

The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, abstract light only. No hand, chains, wall, stone, door, window, sun, clouds, architecture, background, scenery, characters, figures, text, watermark, frame, vignette, bloom, or lens flare.
```

분노는 공격이 아니라 철수다 — 움직임의 방향이 위로만 간다. 균열이 아래로 자라면 `strike`와 구별이 사라진다.

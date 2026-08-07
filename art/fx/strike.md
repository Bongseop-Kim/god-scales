# `strike.webp` — 개입 대상 위 국소 낙하 (4프레임 스트립)

[R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [P-50](../../plans/50-fx-sprites.md) · **상태 스틸 1장 배포 중 — 스트립 미생성 · P-50의 파일럿**

**기준 원본** `art/_src/fx/strike.png` 1536×1024 · **run** `art/_src/sprite-runs/fx_strike/` · **배포본** `art/fx/strike.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 국소 — 약 100px 폭의 배우 스프라이트 하나 위에 합성된다. 카드 파티클과 달리 위에서 한 대상의 발밑으로 떨어진다. 호출부는 [P-46](../../plans/46-presence.md) §3이 놓는다. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 P-50 §3.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 크로마 마젠타 `#ff00ff`, YCbCr 크로마 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot impact: frame 1 the narrow shaft of pale light appears from the top of the frame, not yet touching the ground; frame 2 it lands at the bottom-centre and flares at the point of impact; frame 3 the tight ring of hard-edged sparks at the impact point reaches its widest; frame 4 the shaft is gone and the last sparks fade at the same point. The impact point stays fixed at the bottom-centre and everything to the left and right stays empty in every frame — the effect must read at 100 pixels wide."
}
```

**변환** — 입력은 run의 시트고 출력은 `art/`다.

```
magick art/_src/sprite-runs/fx_strike/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/strike.webp
```

**무손실이 아니다** — 스틸 1장 시절 규칙이었다. 4프레임 스트립은 무손실이 파일당 200KB 상한(`tools/size.ts`)을 깬다. q90 실측이 프레임당 13~36KB라 스트립이 상한 안에 들고, 알파 경계는 `alpha-quality 100`이 지킨다.

## 프롬프트 (기준 프레임)

```text
A single vertical shaft of pale neutral light striking DOWNWARD onto one small point at the bottom-centre of the frame, narrow at the top and flaring where it lands, with a tight ring of hard-edged sparks at the point of impact. The shaft occupies only the central vertical band; everything to the left and right is empty.

This is a small localised effect, not a full-screen one — it is composited over a single character sprite roughly 100 pixels wide, so the impact point must sit at the bottom-centre and the shaft must be narrow enough to read at that size.

The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, abstract light only. No hand, chains, wall, stone, door, window, sun, clouds, architecture, background, scenery, characters, figures, text, watermark, frame, vignette, bloom, or lens flare.
```

여섯 중 유일하게 **낙하 → 착탄 → 잔불**의 인과가 프레임 순서에 들어 있다 — 그래서 파일럿이다. 이 넷이 이어져 보이면 나머지 다섯을 뽑고, 프레임끼리 광원·형태가 튀면 여기서 멈추고 판단한다.

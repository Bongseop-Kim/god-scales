# `calm.webp` — 평온 컷인 오버레이 (4프레임 스트립)

[R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [P-50](../../plans/50-fx-sprites.md) · **상태 스틸 1장 배포 중 — 스트립 미생성**

**기준 원본** `art/_src/fx/calm.png` 1536×1024 · **run** `art/_src/sprite-runs/fx_calm/` · **배포본** `art/fx/calm.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 1440×900 CSS 전체를 덮는 컷인. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 P-50 §3.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 크로마 마젠타 `#ff00ff`, YCbCr 크로마 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니라 부드러운 빛이다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot breath: frame 1 the edge halo at rest; frames 2 and 3 the thin band along the top, left and right edges brightens very slightly and thickens by a hair; frame 4 it settles back near rest. Nothing radiates inward, bursts or streaks; the entire centre and the whole lower half stay completely empty in every frame. This is the quietest of the four overlays — the motion must read as one slow breath, not an event."
}
```

**변환** — 입력은 run의 시트고 출력은 `art/`다.

```
magick art/_src/sprite-runs/fx_calm/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/calm.webp
```

**무손실이 아니다** — 스틸 1장 시절 규칙이었다. 4프레임 스트립은 무손실이 파일당 200KB 상한(`tools/size.ts`)을 깬다. q90 실측이 프레임당 13~36KB라 스트립이 상한 안에 들고, 알파 경계는 `alpha-quality 100`이 지킨다.

## 프롬프트 (기준 프레임)

```text
A full-screen transparent overlay effect: a single faint halo of pale neutral light hugging only the outer edges of the frame, like a quiet presence standing just outside the scene and watching. The glow is strongest in a thin band along the very top, left and right edges and fades to nothing within a short distance inward. It does not move, radiate, burst or streak — it simply rests there.

The entire centre and the whole lower half of the frame must be completely empty of any effect. This is the quietest of four overlays and must read as restraint, not as an event.

The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, abstract light only. No hand, chains, wall, stone, door, window, sun, clouds, architecture, background, scenery, characters, figures, text, watermark, frame, vignette, bloom, or lens flare.
```

넷 중 가장 약하다. 숨 한 번 이상 움직이면 평온이 아니다 — 프레임 간 변화량이 넷 중 가장 작아야 한다.

# `devotion.webp` — 헌신 컷인 오버레이 (4프레임 스트립)

[R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [R-50](../../reviews/50-fx-sprites.md) · **상태 4프레임 스트립 배포 중 · R-50 완료**

**기준 원본** `art/_src/fx/open.png` 1586×992 — 원본 이름은 생성 기록을 보존하고 배포본만 단계 이름으로 부른다. **run** `art/_src/sprite-runs/fx_devotion/` · **배포본** `art/fx/devotion.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 1440×900 CSS 전체를 덮는 컷인. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 R-50.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 크로마 마젠타 `#ff00ff`(기준 원본과 같은 키), YCbCr 크로마 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니라 부드러운 빛이다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot descent: frame 1 the shafts of light are short stubs just entering from the top edge; frames 2 and 3 they extend downward and brighten with sparse motes drifting inside them; frame 4 they hang at full length, glowing and beginning to soften. The light never reaches the middle of the frame; the centre and bottom stay completely empty in every frame."
}
```

**변환** — 입력은 run의 시트고 출력은 `art/`다.

```
magick art/_src/sprite-runs/fx_devotion/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/devotion.webp
```

**무손실이 아니다** — 스틸 1장 시절 규칙이었다. 4프레임 스트립은 무손실이 파일당 200KB 상한(`tools/size.ts`)을 깬다. q90 실측이 프레임당 13KB(이 그림)~36KB(burst)라 스트립이 상한 안에 들고, 알파 경계는 `alpha-quality 100`이 지킨다.

## 프롬프트 (기준 프레임)

```text
A full-screen transparent overlay effect: only several shafts of pale divine light splitting apart and pouring DOWNWARD from the very top edge of the frame, widening slightly as they descend, as if a sealed way has just opened from above. The light originates entirely at the top edge and fades out completely before reaching the middle. Soft muted golden-white beams with hard-edged gaps between them, with sparse restrained motes inside the beams.

The center and bottom of the image must be entirely empty of any effect so the game screen stays visible beneath it. The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, abstract light only. No hand, chains, wall, stone, door, window, sun, clouds, architecture, background, scenery, characters, figures, text, watermark, frame, vignette, bloom, or lens flare.
```

신 색은 코드가 칠한다. 헌신은 위에서 갈라지며 내려오고 중앙·하단은 **네 프레임 전부에서** 비운다.

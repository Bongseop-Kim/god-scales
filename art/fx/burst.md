# `burst.webp` — 공용 파티클 오버레이 (4프레임 스트립)

[P-32](../../plans/32-art.md) §4 · [R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [P-50](../../plans/50-fx-sprites.md) · **상태 스틸 1장 배포 중 — 스트립 미생성**

**기준 원본** `art/_src/fx/burst.png` 1586×992 · **run** `art/_src/sprite-runs/fx_burst/` · **배포본** `art/fx/burst.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 1440×900 CSS 전체. 단계 그림과 별개인 **공용 세기 레이어**다 — `devotion`·`calm`·`anger`·`wrath`의 대체 그림으로 쓰지 않는다. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 P-50 §3.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 크로마 마젠타 `#ff00ff`, YCbCr 크로마 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot scatter: frame 1 a tight sparse ring of particles surrounding (never covering) the clear centre; frames 2 and 3 the particles fly outward toward the edges, spreading and thinning; frame 4 only the outermost embers remain, small and fading. Hard-edged particles, no motion blur, no streaks; the very centre stays clear and the game screen stays readable through the effect in every frame."
}
```

**변환** — 입력은 run의 시트고 출력은 `art/`다.

```
magick art/_src/sprite-runs/fx_burst/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/burst.webp
```

**무손실이 아니다** — 스틸 1장 시절 규칙이었다. 이 그림이 여섯 중 가장 무겁다: 무손실 스틸 67KB × 4프레임 = 272KB로 파일당 200KB 상한(`tools/size.ts`)을 깬다. q90 실측 36KB/프레임 → 스트립 ~145KB로 상한 안이고, 알파 경계는 `alpha-quality 100`이 지킨다. **스트립이 200KB를 넘으면 q85로 내린다(실측 28KB/프레임) — 원본은 건드리지 않는다.**

## 프롬프트 (기준 프레임)

```text
A full-screen transparent overlay effect: a scatter of small hard-edged particles and embers thrown outward from the centre of the frame, densest in the middle band and thinning to nothing at the edges. Pale neutral white-grey particles with no colour of their own, varying sizes, no motion blur, no streaks.

The particles must be sparse enough that the game screen stays readable through them, and the very centre must stay clear. The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, effect only, no scenery, no scenery, no characters, no figures, no text, no watermark, no frame, no vignette.
```

- **색을 넣지 않는다.** 단계 컷인 위에 얹혀 세기를 올리는 공용 레이어라 신 색은 코드가 칠한다
- 입자가 밖으로 날아가는 방향이 프레임에 들어 있으므로, 코드 쪽 scale 연출과 겹치면 두 배로 커 보인다 — 얹는 쪽이 확인한다

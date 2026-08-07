# `wrath.webp` — 진노 컷인 오버레이 (4프레임 스트립)

[R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [P-50](../../plans/50-fx-sprites.md) · **상태 스틸 1장 배포 중 — 스트립 미생성**

**기준 원본** `art/_src/fx/block.png` 1586×992 — 원본 이름은 생성 기록을 보존하고 배포본만 단계 이름으로 부른다. **run** `art/_src/sprite-runs/fx_wrath/` · **배포본** `art/fx/wrath.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 1440×900 CSS 전체를 덮는 컷인. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 P-50 §3. 조우 시작의 진노는 신 일러가 뜬다(`ui/combat.tsx:125`) — 이 스트립은 개입 턴 몫이다.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 크로마 마젠타 `#ff00ff`, YCbCr 크로마 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니다. 검은 실루엣의 탁한 붉은 테두리(#9b2226 계열)는 마젠타 키의 `-fx` 조건이 안 먹는 색으로 검증된 자리다 — 다른 키로 바꾸지 않는다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot pressure: frame 1 the chains, slab and enormous hand are just entering from the top edge; frames 2 and 3 they press further down across the frame, gaining weight; frame 4 they hold at their lowest point while the thin dull red rim along their lower edges brightens. All motion is downward only; the lower third and the far left and right edges stay completely empty in every frame."
}
```

**변환** — 입력은 run의 시트고 출력은 `art/`다.

```
magick art/_src/sprite-runs/fx_wrath/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/wrath.webp
```

**무손실이 아니다** — 스틸 1장 시절 규칙이었다. 4프레임 스트립은 무손실이 파일당 200KB 상한(`tools/size.ts`)을 깬다. q90 실측이 프레임당 13~36KB라 스트립이 상한 안에 들고, 알파 경계는 `alpha-quality 100`이 지킨다.

## 프롬프트 (기준 프레임)

```text
A full-screen transparent overlay effect: heavy chains, a slab of wall and one enormous open hand pressing DOWNWARD from the top of the frame, crossing the image horizontally and bearing down on whatever is beneath. The pressure reads as coming from above and pushing down. Hard-edged dark silhouettes with a thin rim of dull red light along their lower edges, no interior detail.

The lower third and the far left and right edges must be entirely empty of any effect so the game screen stays visible beneath it. The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform, covering every part of the frame the effect does not occupy — including the entire centre and bottom. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. The magenta is keyed out to transparency afterwards, so the effect must sit on it with clean edges and no magenta glow bleeding into the effect. Orientation: WIDE LANDSCAPE, aspect ratio 16:10, much wider than it is tall, a horizontal banner shape that fills a widescreen display. NOT vertical, NOT portrait, NOT square, NOT a tall panel. The scene is laid out across the WIDTH of the frame; even when the subject itself rises, the frame does not — it stays wide and the climb is read inside a wide frame.

Flat magenta background, effect only, no scenery, no scenery, no characters, no figures, no faces, no text, no watermark, no frame, no vignette.
```

신 색은 코드가 칠한다. 진노는 위에서 아래로만 누른다 — `devotion`(내려오는 빛)과 방향은 같지만 하나는 열리고 하나는 짓누른다. 프레임에 병사를 넣지 않는다.

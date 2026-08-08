# `wrath.webp` — 진노 컷인 오버레이 (4프레임 스트립)

[R-45](../../reviews/45-fx.md) · [원본 규칙](../README.md) · [R-50](../../reviews/50-fx-sprites.md) · **상태 4프레임 스트립 배포 중 · R-50 완료**

**기준 원본** `art/_src/fx/block.png` 1586×992 — 원본 이름은 생성 기록을 보존하고 배포본만 단계 이름으로 부른다. **run** `art/_src/sprite-runs/fx_wrath/` · **배포본** `art/fx/wrath.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**화면** 1440×900 CSS 전체를 덮는 컷인. `ui/fx.ts`의 `playSprite`가 500ms 원샷 `steps(4)`로 넘긴다 — 재생 코드는 R-50. 조우 시작의 진노는 신 일러가 뜬다(`ui/combat.tsx:125`) — 이 스트립은 개입 턴 몫이다.

**생성** `sprite-gen` component-row 파이프라인. `base_image`가 기준 원본이고 아래 프롬프트는 그 원본의 것이다. 셀 `rect 1536×960`, 자동 선택된 마젠타 크로마, RGB 제거. **팔레트 고정·아웃라인·`pixel_unfake` 없음** — 픽셀 아트가 아니다.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot pressure: frame 1 one thin charcoal line enters near the top edge; frames 2 and 3 it settles slightly downward while its shallow centre sag deepens and its thin dull-red lower rim brightens; frame 4 it holds at its lowest point. No objects, figures or second line appear; at least 90 percent of every frame stays completely empty."
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
One isolated charcoal-black horizontal pressure line near the upper fifth of the frame, spanning about 60 percent of the canvas width and only 2 to 3 percent of its height. The line is mostly straight, tapers cleanly at both ends and has one shallow smooth downward sag at the centre. A very thin dull-red rim appears only along its lower edge, strongest beneath the central sag. No second line or enclosed shape.

At least 90 percent of the canvas remains empty. The centre gameplay area and whole lower 75 percent are completely clear. The background behind the effect is a FLAT SOLID MAGENTA #ff00ff fill, completely uniform. Magenta appears nowhere else in the image and no part of the effect itself is magenta, pink, purple or violet. Orientation: WIDE LANDSCAPE, aspect ratio 16:10.

Flat magenta background, abstract effect only. No hand, fingers, chains, slab, wall, ceiling, architecture, eye, face, ring, portal, lightning, cracks, debris, particles, beams, impact, characters, symbols, text, watermark, frame, vignette, or lens flare.
```

진노는 `anger`에서 닫힌 시선이 무게를 얻어 아래로 내려앉는 단계다. 화면을 덮지 않고 선 하나의 하강과 처짐만으로 압력을 만든다.

# `zeus.webp` — 제우스 컷인 일러

[P-32](../../plans/32-art.md) §4 · [원본 규칙](../README.md) · **상태 미생성 · 사이드카도 없었다**

**파일** WebP **세로 2:3**, **생성 원본 해상도 유지 — 축소하지 않는다.**

**화면** 중앙 세로 컷인 약 600×900 CSS. `ui/fx.ts`의 `playSprite`가 얹을 자리다.

**헌신·진노 두 단계가 이 한 장을 같이 쓴다** — `stage_effects`가 실제로 발동하는 건 `devotion`·`wrath` 둘뿐이고(`core/favor.ts:53`), **진노용 일러를 따로 그리지 않는다.** 붉은 그레이딩 + 글리치는 코드가 얹는다.

**융합 10쌍도 신규 에셋 0이다** — 이 다섯 장 중 두 장을 좌우에서 슬라이드인시킨다.

**생성** GPT-image 2.0, `1024×1536` — **세로로 뽑는다**

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
magick art/_src/gods/zeus.png -gravity center -crop 2:3 +repage \
  -quality 90 art/gods/zeus.webp
```

**여기만 세로다.** 배경·오버레이·주인공 일러가 전부 가로 16:10인 것과 반대라 크기 확인 기준도 반대다 — `magick identify`의 폭이 높이보다 **작아야** 맞다.

생성물은 `art/_src/gods/{name}.png`에 그대로 남긴다. `art/fx/`·`art/hero/`가 원본 없이 깎인 게 이 순서를 건너뛴 결과다.

## 프롬프트

```text
A cut-in illustration of Zeus appearing to intervene in a mortal's climb out of the Underworld. A towering bearded figure seen from slightly below, one arm raised straight ABOVE the head gripping a lightning javelin whose length runs the full height of the frame. Heavy draped himation over one shoulder, bare chest, no helmet, no shield. His face is in shadow; only the raised arm and the javelin catch the light. The pose is a blow held back, not yet thrown.

Composition: VERTICAL PORTRAIT, aspect ratio 2:3, taller than wide — the opposite of every background and overlay in this set. The figure stands full height, centred, filling most of the frame height, with its feet near the bottom edge and headroom above. The left and right thirds stay dark and quiet: two of these images slide in from opposite sides and sit side by side during a fusion cut-in, so nothing important may touch the left or right edge.

Style: hand-painted 2D illustration, painterly but heavily simplified, coarse visible brush texture, a thick black ink outline along the edge of the figure. Not a flat vector icon, not a 3D render, not photorealistic, not a glossy mobile-game gacha portrait.

Lighting and colour: exactly one hue of light in the image, an antique gold #d4a017, covering about one quarter of the frame. That single hue is the ONLY colour in the image and it BURNS out of near-total darkness — the whole rest of the frame is charcoal and deep navy near-black #11131a with coarse brush texture. #d4a017 exactly, never neon, never white-hot, never a white core, no rainbow, no secondary colour, no complementary accent.

The body is UNDAMAGED and flawless: no wounds, no rot, no blood, no gore, nothing torn. No soldier, no second figure, no mortal, no scales, no card frame, no border, no vignette, no text, no numbers, no logo, no watermark, no UI, no bloom, no lens flare.
```

## 주의

- **위로 뻗은 팔이 이 장의 전부다.** 다섯 중 유일하게 세로로 뻗는 실루엣이고 세로 2:3과 맞는다 — 팔을 내리면 프레임의 위 절반이 빈다
- 번개창이 프레임 높이를 다 쓰게 한다 — 가로 배경에서는 못 하는 구도라 컷인이 세로인 이유가 여기다
- **신 색은 §3 정본 하나뿐이다** — 제우스는 `#d4a017`. `ui/style.css:2` CSS 변수 쪽이 정본이고 `ui/app.tsx:37` `godColors`는 범례에서만 쓰인다
- **병사를 넣지 않는다.** 신 일러가 화면을 차지하는 순간이라 둘이 겹치면 신이 작아진다 — 병사는 컷인 **뒤**에 픽셀 스프라이트로 그대로 서 있고 오버레이가 그 위를 덮는다
- **여기는 하데스 2 톤이다**(§0.5). 픽셀이 저채도 DD2를 지키니 컷인은 반대로 간다 — 어둠 위에서 신 색 하나가 발광한다. 저채도로 그리면 순간적으로 뜨는 컷인이 사건으로 안 읽힌다
- **32×32 진노 스프라이트(`enemy_god_*.png`)와 같은 신이지만 규칙이 반대다** — 스프라이트는 신 색 2~3픽셀이 상한이고 여기는 화면의 1/4이다. 매체가 다르면 톤도 다르다

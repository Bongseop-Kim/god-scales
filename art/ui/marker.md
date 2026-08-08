# `marker.png` — 지도 현재 위치 마커

[P-32](../../plans/32-art.md) §2.5 · [원본 규칙](../README.md) · **상태 미생성**

**파일** PNG 알파. **여기만 16×16이 곧 파일 크기다** — 격자 숫자가 화면 참고값인 다른 에셋과 반대다. `.map-node.current`에 얹힌다 — 지금은 테두리 색만 바뀌는데 **병사가 어디까지 올라왔는지가 지도의 핵심**이다.

**생성** GPT-image 2.0, `1024×1024` — 정사각으로 뽑는다, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
# 16×16은 사람이 찍는 게 제일 깔끔하다. 생성으로 갈 때는 **box 필터로만** 줄인다 —
# 기본 보간은 16px에서 실루엣을 회색 죽으로 만든다
magick art/_src/ui/marker.png -alpha on -fuzz 35% -transparent '#00ff00' \
  -trim +repage -filter box -resize 16x16 -colors 6 art/ui/marker.png
```

**이 한 장만 `-resize`가 허용된다.** 16×16이 최종 크기이자 원본 규격이라 축소가 손실이 아니다 — 대신 생성물은 `art/_src/ui/marker.png`에 그대로 남긴다.

**줄인 뒤 눈으로 본다.** 16px에서 실루엣이 안 읽히면 그 자리에서 직접 찍는 게 빠르다 — 아래가 그 지침이다.

## 작업 방법

**직접 찍는 쪽이 여전히 1순위다.** 생성 프롬프트는 실루엣 참고용이고, 16×16은 손으로 찍는 게 결과가 낫다.

§5의 32×40 스프라이트를 **축소하지 말고 실루엣만 새로 찍는다** — 32×40을 16으로 줄이면 뭉갠다.

16×16 안에 병사의 상반신 실루엣만. 위를 보는 자세는 유지한다. 색은 뼈색 실루엣 + 어두운 1픽셀 외곽선, 배경 투명. 쓰는 색은 **4~6개**로 끝낸다.

## 프롬프트

```text
A single tiny pixel-art map marker: the head and shoulders of one ancient Greek soldier in a battered helmet, seen from the front and TILTED UPWARD as if looking up at something far above him. Bust only, cut off at the chest, no arms, no weapon, no legs.

Read as an extremely coarse icon: built from very large flat square pixels, roughly 16 by 16 blocks across the whole image and no finer detail than that anywhere, a hard 1-pixel dark outline all the way around the silhouette, at most 5 flat colours total in bone white, cold gray-blue and near-black. The silhouette alone must identify it at 16 pixels wide.

Centred on a fully transparent background with even margins. No scenery, no ground, no shadow, no glow, no anti-aliasing, no gradients, no soft edges, no map, no pin shape, no arrow, no banner, no flag, no text, no watermark, no multiple poses.
```

## 주의

- **화면에는 두 크기로 뜬다.** 결과 화면의 읽는 격자는 칸이 97×30px이라 16px 원본 그대로고, 경로 화면(`.walkable`)은 칸이 약 220×72px이라 **정수 2배인 32px**로 뜬다(P-63). 2배·3배 외의 배율은 금지다 — 1.5배는 `image-rendering: pixelated`로도 픽셀이 뭉갠다
- **노드 아이콘 다섯(전·정·휴·?·보)은 P-33이 game-icons 벡터로 맡는다.** 여기서 그리지 않는다
- **핀·화살표·깃발을 그리지 않는다.** 지도 마커의 관습 도형을 넣으면 16px에서 그 도형만 남고 병사가 사라진다 — 병사의 상반신이 마커라는 게 이 한 장의 내용이다
- **위를 보는 자세가 §0.4의 상승이다.** 지도가 위에서 아래로 6층 → 1층을 깔고 병사는 위로 간다 — 마커가 아래를 보면 방향이 거꾸로 읽힌다

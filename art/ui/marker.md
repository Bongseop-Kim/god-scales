# `marker.png` — 지도 현재 위치 마커

[P-32](../../plans/32-art.md) §2.5 · [원본 규칙](../README.md) · **상태 미생성**

**파일** PNG 알파, **생성 원본 해상도 유지 — 축소하지 않는다.** 화면 크기는 `ui/style.css`가 정한다: 경로 화면 36×48, 결과 화면 18×24. `.map-node.here`의 **가운데**에 얹힌다 — 테두리 색만으로는 **병사가 어디까지 올라왔는지**가 안 읽힌다.

**생성** GPT-image 2.0, `1024×1024 이상` — 정사각으로 뽑는다, **투명 배경 옵션 ON**, PNG

**변환** — 입력은 `art/_src/` 원본이고 출력은 `art/`다. **두 경로를 같게 쓰면 원본이 그 자리에서 깎인다.**

```
# 생성기는 투명 배경을 써도 옅은 체크무늬를 **불투명하게** 굽는다. 전역 `-transparent`로 빼면
# 얼굴의 뼈색 하이라이트까지 같이 뚫린다 — 그래서 테두리 한 줄을 덧대고 **바깥에서만** 채운다
magick art/_src/ui/marker.png -bordercolor '#f8f7f6' -border 1 \
  -alpha set -fuzz 12% -fill none -draw 'alpha 0,0 floodfill' \
  -trim +repage -strip art/ui/marker.png
```

**여백만 자른다.** 다른 에셋과 같은 규칙이다 — `-resize`·`-colors`를 걸지 않는다. 화면에서 40px 남짓으로 뜨는 그림이라 파일이 500KB 가까이 되는 값은 치른 것이다(줄이려면 CSS 크기의 2배까지만 `-resize`한다).

**세로가 가로보다 길다**(3:4). CSS가 `background-size: contain`을 쓰는 이유가 그것이다 — 정사각 상자에 넣으면 병사가 눌린다.

## 작업 방법

**직접 찍는 쪽이 여전히 1순위다.** 생성 프롬프트는 실루엣 참고용이다.

§5의 32×40 스프라이트를 **축소하지 말고 실루엣만 새로 찍는다.**

병사의 상반신 실루엣만. 위를 보는 자세는 유지한다. 색은 뼈색 실루엣 + 어두운 1픽셀 외곽선, 배경 투명.

## 프롬프트

```text
A single tiny pixel-art map marker: the head and shoulders of one ancient Greek soldier in a battered helmet, seen from the front and TILTED UPWARD as if looking up at something far above him. Bust only, cut off at the chest, no arms, no weapon, no legs.

Read as a coarse icon: built from very large flat square pixels, roughly 32 by 32 blocks across the whole image and no finer detail than that anywhere, a hard 1-pixel dark outline all the way around the silhouette, at most 8 flat colours total in bone white, cold gray-blue and near-black. The silhouette alone must identify it at 32 pixels wide.

Centred on a fully transparent background with even margins. No scenery, no ground, no shadow, no glow, no anti-aliasing, no gradients, no soft edges, no map, no pin shape, no arrow, no banner, no flag, no text, no watermark, no multiple poses.
```

## 주의

- 경로 화면(`.walkable`)은 칸이 약 240×72px이라 36×48로, 결과 화면의 읽는 격자는 칸이 97×30px이라 **그 절반인 18×24**로 뜬다 — 그 이상 크면 칸을 넘는다
- **노드 아이콘 다섯(전·정·휴·?·보)은 P-33이 game-icons 벡터로 맡는다.** 여기서 그리지 않는다
- **핀·화살표·깃발을 그리지 않는다.** 지도 마커의 관습 도형을 넣으면 작은 크기에서 그 도형만 남고 병사가 사라진다 — 병사의 상반신이 마커라는 게 이 한 장의 내용이다
- **위를 보는 자세가 §0.4의 상승이다.** 지도가 위에서 아래로 6층 → 1층을 깔고 병사는 위로 간다 — 마커가 아래를 보면 방향이 거꾸로 읽힌다

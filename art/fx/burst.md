# `burst.webp` — 공용 파티클 오버레이 (4프레임 스트립)

[원본 규칙](../README.md) · **상태 4프레임 스트립 배포 중**

**기준 원본** `art/_src/fx/burst.png` 1586×992 · **run** `art/_src/sprite-runs/fx_burst/` · **배포본** `art/fx/burst.webp` 4프레임 가로 스트립 6144×960, WebP 손실 q90 + `alpha-quality 100`.

**생성** `sprite-gen` component-row 파이프라인. 셀 `rect 1536×960`, 자동 선택된 마젠타 크로마, RGB 제거. 팔레트 고정·아웃라인·`pixel_unfake` 없음.

## 동작 (sprite-gen states)

```json
"play": {
  "frames": 4, "fps": 8, "loop": false,
  "action": "four-frame one-shot scatter: a single open-ended angular particle thread stretches outward around a clear centre, with sparse ivory fragments attached along it. The top and bottom thirds stay empty."
}
```

**변환**

```
magick art/_src/sprite-runs/fx_burst/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/burst.webp
```

색은 코드가 칠한다. 중앙을 비우고 다른 단계보다 약한 밀도로 유지한다.

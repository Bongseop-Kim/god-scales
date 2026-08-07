# P-50 · 컷인이 움직인다 — fx 여섯을 4프레임 스트립으로

`plans/50-fx-sprites.md` · [색인](../reviews/00-index.md) · 관련 [P-46](46-presence.md)(직교 — 아래 「함정」)

**크기** 중간 · **착수 조건** 없음. 에셋 6 + `ui/fx.ts` 한 함수 + CSS 몇 줄이다.

적·병사·프롭은 P-37 이후 4프레임 idle 루프로 움직이는데(`motion.css:22`의 `steps(4)`) **컷인만 스틸 1장을 480ms 페이드로 띄운다**(`ui/fx.ts:17`). 스틸+페이드는 「그림이 떴다」로 읽히고 프레임 재생은 「이펙트가 터졌다」로 읽힌다 — 신의 개입이 이 게임에서 가장 큰 사건인데 그 자리가 가장 정적이다. 생성 파이프라인(`sprite-gen` component-row)과 재생 관례(4셀 스트립·`steps(4)`)가 둘 다 이미 있으므로, 이 계획은 fx 여섯을 그 관례에 태우는 것이다.

**정본은 사이드카다.** `art/fx/*.md` 여섯 장이 이미 스트립 스펙(셀·크로마·states·변환 명령·프레임별 동작)으로 갱신돼 있다 — 이 계획은 실행 순서와 코드 쪽만 든다.

---

## 완료 정의

**전투 컷인이 떴을 때 네 프레임이 순서대로 한 번 재생되는 것을 `aside`로 눈으로 확인한다** (브라우저 확인은 `aside` CLI로만 — CLAUDE.md).

```bash
npx tsc --noEmit && npm test
npm run art -- --check      # fx 여섯 대조 그대로 통과 — 파일 이름이 안 바뀐다
npm run size                # 위반 0 — 파일당 200KB · 전체 4MiB
npm run e2e                 # 컷인은 pointer-events:none·관측 밖이라 기준선 불변이어야 한다
```

| 항목 | 판정 기준 |
|---|---|
| 에셋 | `art/fx/{devotion,calm,anger,wrath,burst,strike}.webp` 여섯이 6144×960 4프레임 스트립 — `magick identify -format '%wx%h'`로 확인 |
| 원본 | run 전체가 `art/_src/sprite-runs/fx_{name}/`에 남는다. 기존 스틸 원본(`art/_src/fx/*.png`)은 **한 픽셀도 안 건드린다** — `base_image` 입력일 뿐이다 |
| 재생 | `playSprite`가 원샷 `steps(4)` ~500ms — 루프 없음, 재생 후 DOM에서 사라진다(지금과 같다) |
| 파티클 | `art/particle/*.webp`(1프레임)는 지금처럼 뜬다 — `spark` 경로가 스트립 재생에 말려들지 않는다 |
| reduced-motion | 지금과 같다 — 컷인 자체를 안 띄운다(`combat.tsx:120`). 문장 배너로 바꾸는 것은 P-46 §2의 몫이다 |
| 게이트 | 규칙·데이터·봇 불변이라 밸런스는 안 잰다. `npm run size`가 유일한 새 판정 자리다 |

---

## 설계

### 1 · 파일럿 — `strike` 하나로 끝까지 간다

생성 → 변환 → 재생 배선 → `aside` 확인을 **strike 한 장으로 먼저 완주한다.** strike만 낙하 → 착탄 → 잔불의 인과가 프레임 순서에 들어 있어(사이드카 §동작) 프레임 간 일관성이 깨지면 가장 먼저 보인다.

파일럿 판정: 네 프레임이 한 동작으로 이어져 보이면 §2로. **프레임끼리 광원·형태가 튀어 플리커로 보이면 멈추고 사용자에게 보고한다** — 나머지 다섯을 뽑는 것은 그 판단 뒤다.

### 2 · 생성 — run 여섯

`sprite-gen` 요청은 사이드카가 정본이다. 공통값만 여기 적는다:

| 필드 | 값 | 왜 |
|---|---|---|
| `character.base_image` | `art/_src/fx/{원본}.png` | 배포 중인 스틸이 곧 기준 프레임 — 새로 그리지 않는다 |
| `cell` | `rect 1536×960`, 마진 0 | 생성 상한이 1536이고 배포본이 1536×960이다. 여백 규칙(중앙 비움 등)은 프롬프트가 이미 든다 |
| `states` | `play` 하나 — 4프레임 · 8fps · `loop: false` | 4프레임 8fps = 500ms ≈ 지금 컷인 480ms. idle/attack 분화는 재생 코드가 없다 |
| `chroma_key` | 마젠타 `#ff00ff` | 스틸 여섯이 이 키로 설계됐다(`wrath`의 탁한 붉은 테두리가 이 키만 안 먹는다) |
| `fit` | **`pixel_unfake`·`palette_size`·`outline` 끈다** | 픽셀 아트가 아니라 부드러운 빛이다 — kcentroid·팔레트 96이 글로우를 밴딩시킨다 |

base 이름 매핑 둘만 주의: `devotion` ← `open.png`, `wrath` ← `block.png` (원본 이름은 생성 기록 보존 — R-45).

### 3 · 변환 — 손실 q90, 스틸 시절의 「무손실」 규칙을 갈아탄다

```
magick art/_src/sprite-runs/fx_{name}/sprite-sheet-alpha.png \
  -quality 90 -define webp:alpha-quality=100 art/fx/{name}.webp
```

무손실 스틸이 24~67KB였다 — ×4프레임이면 최악(burst) 272KB로 **파일당 200KB 상한을 깬다.** q90 실측(원본 스틸 재인코딩)이 프레임당 13~36KB라 스트립 최악 ~145KB로 들어오고, 전체는 fx 0.26 → ~0.45MiB · 번들 3.22 → **~3.4MiB**(상한 4)다. 알파 경계는 `alpha-quality 100`이 지킨다. 어느 스트립이든 200KB를 넘으면 q85(실측 28KB/프레임)로 내린다 — **원본이 아니라 배포본 품질만 내린다.**

### 4 · 재생 — `ui/fx.ts` 한 함수, 새 의존 0

`playSprite`는 지금 이미지를 통째로 띄워 opacity만 굴린다. 스트립은 **프레임 하나 크기의 뷰포트 + `overflow: hidden` + 이미지 폭 400%**로 넘긴다 — `.sprite`가 쓰는 관례 그대로, 다만 루프가 아니라 원샷 WAAPI다:

```ts
// 뷰포트(aspect-ratio 1536/960)에 img 폭 400%를 넣고
img.animate([{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }],
  { duration: 500, easing: "steps(4)" });
// 기존 opacity 봉투(0→1→0)는 뷰포트 쪽에 그대로 둔다 — 등장·퇴장이 갑자기 끊기지 않는 값이다
```

- `kind: "spark"`(파티클 1프레임)는 지금 경로 그대로 — 스트립 분기는 `cut`에만 건다. 인자를 늘리기보다 **이미지 로드 후 `naturalWidth / naturalHeight ≥ 4`로 스트립을 식별**하는 쪽이 호출부 여섯을 안 고친다 (판단은 구현에서 — 어느 쪽이든 호출부 시그니처 변화 최소가 기준)
- `.fx.cut`의 CSS(`max-width: 100%` 등)는 뷰포트 기준으로 옮긴다 — 화면비 16:10 유지, 배우를 덮는 배치 불변
- `steps(4)`의 마지막 스텝이 **빈 칸(-100%)을 보이지 않는지** `aside`로 확인한다 — jump 종류에 따라 마지막 20ms에 스트립 밖이 보일 수 있다. 보이면 `translateX(-75%)` + `steps(3, jump-none)`류로 조정

### 5 · 확인

- `aside`로 전투 진입 → 1턴 컷인(조우 시작)과 2턴 개입 컷인이 각각 4프레임 재생되는 것을 확인
- run별 `qa-notes.md`·`sprite-sheet-alpha.report.json`에서 크로마 잔광(`spill_max_fraction`)과 프레임 일관성 확인
- 위 「완료 정의」의 명령 네 줄

---

## 함정

- **P-46이 같은 파일을 만진다.** P-46 §2가 `playSprite`에 `label` 인자를 붙이고 §4가 fx 파일명을 직접 배선한다 — **파일 이름·`stageCut`은 여기서 안 바뀌므로 데이터 충돌은 없다.** 코드는 먼저 간 쪽 위에 나중 쪽이 얹는다. P-46이 먼저 끝나 있으면 reduced-motion 배너(정적 1프레임)도 스트립의 **첫 셀만** 보여야 한다 — 뷰포트 방식이면 공짜다
- **`fit`을 안 끄면 글로우가 죽는다.** 캐릭터 run의 `kcentroid`·`palette_size: 96`·`outline`은 픽셀 아트 몫이다 — 부드러운 빛에 걸면 밴딩과 검은 테두리가 생긴다. 사이드카가 전부 「없음」으로 못박아 뒀다
- **마젠타 잔광.** 글로우의 부드러운 가장자리는 크로마와 섞인 픽셀이 넓다 — YCbCr unmix가 잡는지 report의 spill 수치로 확인하고, 눈으로는 **어두운 배경 위에서** 본다(전투 배경이 어둡다)
- **`art --check`·`size`는 이름과 무게만 본다** — 스트립인지 스틸인지 모른다. 6144×960 확인은 `magick identify` 손검사다(완료 정의 표)
- **`art/_src/gen-docs.mjs`의 fx 절이 P-45 이전(open/block 스틸)이다.** 색인 「남은 작업」에 이미 있는 부채고, 이번 사이드카 갱신으로 간극이 더 벌어졌다 — **gen-docs를 돌려 사이드카를 재생성하지 않는다.** 생성기 동기화는 이 계획 범위 밖이다
- **기존 스틸 원본을 덮지 않는다.** `art/_src/fx/*.png`는 `base_image` 입력이다 — 출력 경로가 `art/_src/fx/`를 향하는 순간 원본 소실 사고(art/README.md §사고 경위)의 재판이다

## 안 하는 것

- **파티클·신 일러·프롭·배경은 안 건드린다** — fx 여섯만
- **프레임을 4보다 늘리지 않는다** — 파이프라인·재생 관례가 4셀이고, 500ms 컷에 8프레임은 무게 두 배에 값이 없다
- **루프 없음** — 컷인은 원샷이다. idle/attack 같은 다단 state도 없다(`play` 하나)
- **파티클 엔진·스프라이트 풀·애니메이션 라이브러리 금지** — `playSprite` 한 함수 + WAAPI가 계속 전부다(`ui/fx.ts` 주석)
- **새 게이트·지표 없음** — 규칙·데이터 불변, 판정은 기존 `size`·`art --check`·e2e 기준선이다

# P-37 · 에셋 배선 — 있는 것을 화면에 올린다

`plans/37-wire.md` · [◀ P-36](36-shove.md) · [색인](../reviews/00-index.md)

**크기** 큼 · **착수 조건** 없음. 규칙·데이터·봇을 하나도 안 건드린다 — 화면과 빌드만 움직인다

[R-32](../reviews/32-art.md)가 파일 83개를 다 만들고 **붙이는 코드를 계획에서 뺐다.** 그래서 지금 화면에 뜨는 에셋은 0장이다. `ui/card.tsx:5`가 `art/cards/*.webp`를 glob하지만 키가 `{cardId}.webp`라 129장 중 한 장도 안 맞는다 — **유일하게 배선된 자리마저 안 맞고 있다.**

이 계획은 그림을 하나도 안 그린다. 있는 파일을 화면에 올리고, 올라갔는지를 **사람 눈이 아니라 게이트가** 판정하게 한다.

---

## 완료 정의

**여덟 화면에 에셋이 뜨고, 어긋난 파일명은 게이트가 잡고, 번들이 4MiB를 안 넘는다.**

```bash
npx tsc --noEmit && npm test
npm run art -- --check       # required_missing=0 · 여섯 종류 대조 위반 0
npm run size                 # 번들되는 것만 세고 4MiB 이하 · 위반 0
npm run build
npm run e2e -- --dist        # 12층 완주 + 여덟 화면 1440px + 스크린샷 8장
```

| 항목 | 판정 기준 |
|---|---|
| 적 | `.enemy`마다 96px 스프라이트가 서고, 파일 없는 적은 지금 모양 그대로 (폴백) |
| 카드 | 129장 전부 그림이 있다 — `{patron}_{tag}` 20장과 `card_fused_*` 10장이 129장을 덮는다 |
| 배경 | 지도·전투·보스가 지역별로 갈린다 (6장) |
| 컷인 | `playSprite`가 실제로 불린다 — 개입에 오버레이 3, 진노에 신 일러 5 |
| 결과 | 승·패·시작 화면에 주인공 일러 3장 |
| 프레임·마커 | 카드에 청동 테두리가 두르고, 지도에 현재 위치 마커가 선다 |
| 커서·파티클 | 커서가 픽셀이고, 카드를 낼 때 태그별 파티클이 한 장 튄다 |
| 빠짐 | **제작 에셋 83개가 전부 번들에 있다** — `art --check`가 종류별 개수를 센다 |
| 대조 게이트 | `art --check`가 **데이터 id ↔ 파일명**을 여섯 종류로 대조하고, 어긋나면 exit 1 |
| 무게 | `npm run size`가 **번들되는 것만** 세고 통과한다 (지금은 681MB를 재고 있다) |
| 밸런스 | **안 잰다.** 규칙이 안 바뀐다 — [P-26](../reviews/26-hud.md) 선례 (CLAUDE.md) |

---

## 0 · 순서 — 게이트를 먼저 짠다

이 계획의 배선은 **기계적**이다. 파일명이 이미 데이터 id와 1:1이다:

```
data/enemies.json  "enemy_under_pressure"  ↔  art/sprites/enemy_under_pressure.png
data/gods.json     "zeus"                  ↔  art/gods/zeus.webp
```

그래서 **어긋남은 눈이 아니라 문자열 비교가 잡는다.** 순서가 뒤집히면 안 된다:

| 단계 | 하는 일 | 검토 |
|---|---|---|
| ① | `tools/art.ts --check`를 카드 전용(27줄) → 여섯 종류 대조로 넓힌다 | 없음 — 이게 검토 도구다 |
| ② | 배선 여덟 자리를 한 번에 짠다 | `art --check` · `size` · `tsc` |
| ③ | `e2e -- --dist` 스크린샷 8장 | **사람 눈은 여기 한 번** |

**②를 화면 하나씩 사람이 확인하며 진행하지 않는다.** 눈이 잡는 것은 크기·정렬·z-order·대비 넷뿐이고 그건 ③의 스크린샷 8장이 똑같이 보여준다. 파일명 어긋남은 ①이 전수로 잡는다 — 눈보다 촘촘하다. [R-32](../reviews/32-art.md)의 「게이트가 두 번 새어 나갔다 — 목록을 눈으로 훑었기 때문이다」가 그 근거다.

---

## 1 · 배선은 한 줄의 반복이다

정본은 이미 `ui/card.tsx:5`에 있다.

```ts
const cardArt = import.meta.glob<string>("../art/cards/*.webp", { eager: true, query: "?url", import: "default" });
```

나머지도 이 한 줄이다. 로더·매니페스트·에셋 레지스트리를 만들지 않는다 — Vite가 이미 그 일을 한다.

**`art/_src/**`를 glob하지 않는다.** 617MB에 원본 1,700여 장이 있다(`art/README.md` 규칙 4). 패턴은 항상 `../art/<종류>/*.<확장자>` 한 단계로 고정한다.

### 아홉 자리 — 83개를 하나도 안 남긴다

| # | 자리 | 파일 | 열쇠 |
|---|---|---|---|
| 1 | `ui/combat.tsx:81` `.enemy` | `art/sprites/{id}.webp` 19 | `enemy.id` 그대로 |
| 2 | `ui/combat.tsx:149` `.player-actor` | `art/sprites/player.webp` | 고정 |
| 3 | `ui/card.tsx:57` | `art/cards/*.webp` 30 | §2 폴백 |
| 4 | 전투·지도 배경 | `art/bg/*.webp` 6 | `{region}-{combat\|boss}` · `map-{region}` |
| 5 | `ui/fx.ts` 호출부 | `art/fx/*.webp` 3 + `art/gods/*.webp` 5 | 개입·진노 |
| 6 | `result`·시작 화면 | `art/hero/hero-{title\|win\|loss}.webp` | 고정 |
| 7 | 배경 위 프롭 | `art/props/{region}_*.webp` 14 | 지역 접두사 |
| 8 | `.game-card` 테두리 · `.map-node` 현재 위치 | `art/ui/card-frame.webp` · `art/ui/marker.png` | 고정 |
| 9 | 커서·파티클 | `art/cursor-pixel/` 4 · `art/particle/` 4 | §5 |

합이 **83개**다(스프라이트 20 · 배경 6 · 프롭 14 · 카드 30 + 프레임 1 · 신 일러 5 · 컷인 3 · 주인공 3 · 마커 1). 한 장이라도 빠지면 `art --check`가 종류별 개수에서 잡는다 — R-32가 만든 83이 그대로 게이트의 기대값이다.

### 8번 자리 — 프레임과 마커

- **`card-frame`은 무채색 청동 한 장이다**(`art/ui/card-frame.md`). 신별로 5장을 안 그린 이유가 CSS로 칠하기 위해서다 — `.game-card`에 `border-image`로 두르고 진영색을 `filter`로 얹는다. 카드가 화면에서 약 105px인데 파일은 1009×1381 · 1.1MB라 §3의 배포본 축소를 같이 받는다
- **`marker.png`는 16×16 · 420B라 그대로 쓴다.** 유일하게 `-resize`가 허용된 파일이고(`art/ui/marker.md`) 이미 최종 크기다. `.map-node` 중 **지금 서 있는 칸**에만 얹는다 — 노드 종류 아이콘 5개는 [P-33](33-icons.md) 몫이고 이건 현재 위치 하나다

`.player-actor`와 좌우 스왑(`combat-layout`)은 이미 있다. **병사는 오른쪽을 보고 적은 왼쪽을 본다**(P-32 §1) — 좌우 반전을 넣지 않는다. 스프라이트가 이미 그 방향으로 그려져 있고, 반전하면 방패 든 손이 바뀐다.

`ui/app.tsx:37`의 `godColors`를 지운다. hex 정본은 R-32 §3 표다.

---

## 2 · 카드 폴백 — 129개 id를 30장이 덮는다

`ui/card.tsx:57`이 `{cardId}.webp`를 찾는데 그런 파일은 **한 장도 없다.** 실제 30장은 두 모양이다:

| 모양 | 수량 | 짓는 법 |
|---|---:|---|
| `{patron}_{tag}.webp` | 20 | `card.patron` + `card.tags[0]` (`attack`·`defend`·`token`·`utility`) |
| `card_fused_{a}_{b}.webp` | 10 | 융합 카드 — `patron`이 `"athena+zeus"` 꼴이다 |

**함정: 융합 파일명의 신 순서가 `patron` 문자열과 다르다.** `patron: "athena+zeus"`인데 파일은 `card_fused_zeus_athena.webp`다. 두 순서를 다 시도하고, **둘 다 없으면 게이트가 잡는다** — 이 규칙을 코드가 아니라 `art --check`에 적는 이유다. 10쌍 중 몇 개가 뒤집혀 있는지 눈으로 세지 않는다.

폴백 순서: `{cardId}` → `{patron}_{tag}` → `card_fused_*` → 지금의 ⚖ 글리프. 마지막 단은 남긴다 — 새 카드가 들어와도 화면이 안 깨진다.

`tools/art.ts:22`의 `required_missing`이 이 폴백을 인정해야 한다. **지금 값 15는 에셋 상태가 아니라 폴백이 없다는 뜻이다**([R-32](../reviews/32-art.md)). 폴백이 붙으면 0이 된다.

---

## 3 · 무게가 게이트를 깨고 있다 — 지금 681MB를 잰다

```
npm run size  →  assets=2368 bytes=714600291 mib=681.50 violations=3
```

`tools/size.ts:4`가 `art`를 **재귀로** 세서 `art/_src/`(617MB)까지 잡는다. 상한은 4MiB다. **이미 깨져 있고 아무도 안 봤다** — 지금은 번들에 카드 30장(700KB)만 들어가서 `dist`가 960K라 표가 안 났다.

배선하는 순간 이게 실물 문제가 된다:

| 종류 | 디스크 | 화면 크기 | 판정 |
|---|---:|---|---|
| `art/sprites/` | **60MB** | 96px 셀 | 그대로 못 올린다 — `player.png` 한 장이 11MB |
| `art/bg/` | 11MB | 1440px 폭 | 그대로 못 올린다 |
| `art/particle/` | 5.3MB | 512×512 중 쓰는 건 넷 | 쓰는 것만 |
| `art/cursor-pixel/` | 880K | 16×16 중 넷 | 쓰는 것만 (합 1.7KB) |
| `art/ui/card-frame.png` | 1.1MB | 105px 폭 | 배포본 축소 — 원본은 `art/_src/ui/`에 이미 있다 |
| 나머지(cards·gods·hero·fx·marker) | 2.6MB | — | 통과 |

### 배포본을 원본과 가른다 — 있는 관례 그대로

`art/README.md`가 이미 `art/_src/` = 생성 원본 · `art/` = 배포본으로 나눠 놨다. **스프라이트 스트립과 배경이 그 규칙을 안 지키고 있다** — 8064×1024 · 10352×1368이 생성 해상도 그대로 `art/sprites/`에 있다.

```
art/_src/sprites/{id}.png     ← 8064×1024 스트립을 여기로 옮긴다 (디렉터리가 이미 있다)
art/sprites/{id}.webp         ← 화면 해상도 스트립만 남는다
```

- **축소가 아니라 이동이다.** `art/README.md` 규칙 1(원본을 깎지 않는다)을 지킨다 — 원본은 한 픽셀도 안 잃고 자리만 옮긴다
- 배포본은 **개별 포즈 PNG에서 다시 조립한다**(`*_idle_N.png` 등이 옆에 다 있다). 8064를 12로 나누면 안 떨어지는데 포즈 파일을 세면 프레임 수가 정확하다 — `enemy_god_ares`는 9장(idle 4 · attack 2 · death 2 · hit 1)이다
- 셀은 **192×192**(화면 96px × DPR 2). `magick montage -tile x1 -geometry 192x192`
- `ui/motion.css:11`의 `steps(12)`가 스트립마다 다른 프레임 수를 못 받는다. `--frames` CSS 변수로 바꾼다 — 한 줄이다

`art/bg/*.png`도 같다: 원본은 `art/_src/bg/`(이미 4장 있다), 배포본은 1440px 폭 webp.

### `size.ts`는 번들되는 것을 재야 한다

대상을 재귀 `art` → **glob 대상 디렉터리 화이트리스트**로 바꾼다. 세는 것과 실제로 나가는 것이 같아야 게이트가 뜻을 갖는다.

`violations=3`(`fx/block.webp` · `gods/poseidon.webp` · `gods/zeus.webp`)은 200KB 상한 초과다. **상한을 올리지 않는다** — q80으로 다시 뽑는다. 컷인은 480ms 스치는 오버레이라 화질 여유가 있다.

---

## 4 · 배경과 프롭

배경 6장이 두 축이다: **지역**(`under`·`surface`) × **자리**(`combat`·`boss`), 그리고 지도 둘.

```
map-{region}.webp        지도 화면
{region}-combat.webp     전투·정예
{region}-boss.webp       보스
```

쉼터·예고는 배경이 없다 — `{region}-combat`을 쓰고 어둡게 깐다. **새로 그리지 않는다.**

프롭 14장은 접두사가 곧 지역이다(`under_ash`·`surface_eagle`). 층마다 **지역 것 중 둘**을 시드로 골라 배경 위에 얹는다. 셋 이상은 안 얹는다 — 96px 스프라이트를 가린다. 프롭도 스트립이라 §3의 조립을 같이 받는다.

---

## 5 · 커서와 파티클 — 팩 두 개를 최소로 쓴다

**커서 220장 중 넷만 쓴다.** 16×16 PNG라 그대로 CSS에 들어간다.

| 상태 | 타일 | 핫스팟 | 자리 |
|---|---|---|---|
| 기본 | `tile_0026` 화살표 | `0 0` | `body` |
| 누를 수 있는 것 | `tile_0134` 검지 손 | `5 0` | `button:not(:disabled)` · `.game-card` · `.choice` · `.map-node` |
| 대상 지정 중 | `tile_0044` 조준 | `8 8` | `.enemy:not(:disabled)` — `targeting`일 때만 |
| 못 누르는 것 | `tile_0015` 금지 | `8 8` | `button:disabled` · `.game-card[disabled]` |

```css
body { cursor: url(<tile_0026>) 0 0, auto; }
button:not(:disabled) { cursor: url(<tile_0134>) 5 0, pointer; }
```

**폴백 키워드(`auto`·`pointer`·`crosshair`·`not-allowed`)를 반드시 뒤에 붙인다** — PNG 커서를 못 읽는 환경에서 커서가 사라진다.

핫스팟이 상태마다 다르다: 화살표는 촉이 좌상단이라 `0 0`, 손은 검지 끝이라 `5 0`, 조준·금지는 원 중심이라 `8 8`이다. **`0 0`으로 통일하면 손 커서가 반 칸 어긋나 눌리는 자리와 보이는 자리가 달라진다.**

대상 지정은 이 게임에만 있는 상태다(`ui/combat.tsx`의 `targeting`) — 카드를 낸 뒤 적을 고르는 동안이고, 지금은 문구(`대상을 고르세요`)로만 알린다. 커서가 그걸 말하면 문구를 안 읽어도 보인다. 검(`tile_0106`)이 더 그림에 맞지만 촉이 우상단이라 핫스팟이 어색하다 — 조준이 중심 대칭이라 안전하다.

**파티클 81장 중 넷만 쓴다.** 카드 태그 하나에 한 장이다:

| 태그 | 파티클 |
|---|---|
| `attack` | `slash_01` |
| `defend` | `window_01` |
| `token` | `magic_01` |
| `utility` | `spark_01` |

카드를 낼 때 대상 위에서 한 장 튄다. **`playSprite`를 그대로 쓴다** — 파티클 엔진도, 풀도, 스포너도 만들지 않는다. 이미 있는 480ms 페이드가 파티클 한 장에 그대로 맞는다. 512×512 넉 장만 webp로 뽑아 `art/particle/`에 두고 나머지 77장은 glob 밖에 둔다.

색은 안 넣는다 — 흰 파티클에 CSS `filter: hue-rotate()`나 진영색 `mix-blend-mode`면 족하다.

---

## 6 · P-33·P-35와 겹치는 자리

| 계획 | 겹침 | 처리 |
|---|---|---|
| [P-33](33-icons.md) | 「신별 상징 실루엣 5 — 컷인 스윕」 | **P-33에서 뺀다.** `art/gods/*.webp` 5장이 이미 있고 이 계획의 §1-5가 그것을 붙인다. game-icons.net에서 다시 안 고른다 |
| [P-35](35-range.md) | `.enemy`가 4칸이 된다 | 겹치는 건 그 열 하나다. **먼저 끝나는 쪽이 이긴다** — P-37이 먼저면 P-35가 96px 열을 넷으로 늘리고, P-35가 먼저면 P-37이 4칸 위에 붙인다. 어느 쪽이든 한 번만 만진다 |
| [P-36](36-shove.md) | 자리 이동이 「보여야 한다」 | 스프라이트가 붙어 있으면 그 요구가 저절로 선다 |

---

## 7 · 안 하는 것

- **에셋 로더·매니페스트·프리로더.** `import.meta.glob`이 한다
- **스프라이트 아틀라스 툴체인.** 20장이고 `magick montage` 한 줄이다
- **파티클 엔진.** 카드당 한 장이면 `playSprite`로 끝난다
- **`art/particle/Rotated/`·나머지 커서 216장.** 번들에 안 넣는다
- **새 그림.** 쉼터·예고 배경, 6번째 신 일러, 카드 129장 개별 아트 전부 이 계획 밖이다
- **밸런스 재측정.** 규칙이 안 바뀐다

---

## 8 · `public/ATTRIBUTION.md`

저장소 쪽 `ATTRIBUTION.md`는 **이 계획을 쓰면서 갱신했다** — Kenney [Cursor Pixel Pack](https://kenney.nl/assets/cursor-pixel-pack)·[Particle Pack](https://kenney.nl/assets/particle-pack) 둘 다 CC0이고, 없는 파일을 가리키던 옛 문장을 지웠다.

`public/ATTRIBUTION.md`는 **배포본** 표기라 아직 안 고쳤다. 지금은 두 팩이 번들에 안 들어가서 사실이다 — **커서 4장·파티클 4장을 번들에 넣는 순간 거짓이 된다.** 배선과 같은 커밋에서 고친다.

---

## 착수 전에 받아야 하는 것

없다. 커서 타일은 §5에서 골랐고 라이선스는 확인했다.

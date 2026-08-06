# 사용한 자산

배포본은 그림 91장과 아이콘 시트 한 장(symbol 28개)을 담습니다. 외부 폰트 파일은 없고 운영체제의 시스템 폰트와 Georgia를 씁니다.

## 그림 · 스프라이트 — 프로젝트 제작 83장

| 종류 | 수량 |
|---|---:|
| 스프라이트 (적 19 · 병사) | 20 |
| 카드 | 30 |
| 배경 (지도 2 · 전투 2 · 보스 2) | 6 |
| 배경 프롭 | 14 |
| 신 일러 | 5 |
| 컷인 오버레이 | 3 |
| 주인공 일러 | 3 |
| 카드 프레임 · 지도 마커 | 2 |

이미지 생성 도구로 프로젝트에서 직접 만들었습니다. 프롬프트 정본은 `art/_src/gen-docs.mjs`이고 파일마다 옆에 `.md` 사이드카가 있습니다. 카드 129장은 이 30장이 `{patron}_{tag}`·`card_fused_*`로 덮고, 파일이 없을 때는 CSS placeholder로 동작합니다.

## 커서 · 파티클 — Kenney (CC0) 8장

| 자리 | 팩 | 라이선스 |
|---|---|---|
| 커서 4장 (`tile_0026`·`tile_0134`·`tile_0044`·`tile_0015`) | [Cursor Pixel Pack](https://kenney.nl/assets/cursor-pixel-pack) | CC0 1.0 |
| 파티클 4장 (`slash_01`·`window_01`·`magic_01`·`spark_01`) | [Particle Pack](https://kenney.nl/assets/particle-pack) | CC0 1.0 |

CC0이라 귀속 의무는 없습니다. 출처를 남기는 것은 예의이자 재수급 경로를 잃지 않기 위해서입니다. **두 팩의 나머지(커서 216장 · 파티클 77장)는 저장소에만 있고 배포본에 들어가지 않습니다.**

## 아이콘 — game-icons.net (CC BY 3.0) 28개

토큰 10 · 적 패시브 8 · 의도 5 · 지도 노드 5입니다. 예전에는 유니코드 문자와 한글 한 글자였습니다. 파일 28개가 아니라 **`art/icons.svg` 한 장에 `<symbol>` 28개**로 들어가고 `?raw`로 JS 번들에 실립니다 — 아이콘 요청은 0회입니다. 슬러그·저자 정본은 `tools/icons.ts`이고 `npm run icons`가 원본에서 다시 받습니다.

저자 넷 다 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)입니다 — **Icons made by Lorc, Delapouite, Sbed, and Skoll (https://game-icons.net)**. 검은 배경 사각형을 떼고 `fill`을 `currentColor`로 바꾼 것 외에는 원본 그대로입니다.

| 자리 | 아이콘 | 저자 |
|---|---|---:|
| `shock` | [lightning-helix](https://game-icons.net/1x1/lorc/lightning-helix.html) | Lorc |
| `displace` | [big-wave](https://game-icons.net/1x1/lorc/big-wave.html) | Lorc |
| `soaked` | [water-drop](https://game-icons.net/1x1/sbed/water-drop.html) | Sbed |
| `bulwark` | [brick-wall](https://game-icons.net/1x1/delapouite/brick-wall.html) | Delapouite |
| `deflect` | [shield-reflect](https://game-icons.net/1x1/lorc/shield-reflect.html) | Lorc |
| `thorns` | [crown-of-thorns](https://game-icons.net/1x1/lorc/crown-of-thorns.html) | Lorc |
| `bleed` | [blood](https://game-icons.net/1x1/skoll/blood.html) | Skoll |
| `frenzy` | [claws](https://game-icons.net/1x1/delapouite/claws.html) | Delapouite |
| `mark` | [crosshair](https://game-icons.net/1x1/delapouite/crosshair.html) | Delapouite |
| `crit` | [bullseye](https://game-icons.net/1x1/skoll/bullseye.html) | Skoll |
| `guard` | [closed-barbute](https://game-icons.net/1x1/delapouite/closed-barbute.html) | Delapouite |
| `shell` | [scale-mail](https://game-icons.net/1x1/lorc/scale-mail.html) | Lorc |
| `ward` | [rune-stone](https://game-icons.net/1x1/lorc/rune-stone.html) | Lorc |
| `curl` | [armadillo](https://game-icons.net/1x1/delapouite/armadillo.html) | Delapouite |
| `angry` | [screaming](https://game-icons.net/1x1/lorc/screaming.html) | Lorc |
| `rally` | [mighty-horn](https://game-icons.net/1x1/delapouite/mighty-horn.html) | Delapouite |
| `ramp` | [upgrade](https://game-icons.net/1x1/delapouite/upgrade.html) | Delapouite |
| `spite` | [cloak-dagger](https://game-icons.net/1x1/lorc/cloak-dagger.html) | Lorc |
| `damage` | [broadsword](https://game-icons.net/1x1/lorc/broadsword.html) | Lorc |
| `block` | [shield](https://game-icons.net/1x1/sbed/shield.html) | Sbed |
| `heal` | [health-increase](https://game-icons.net/1x1/sbed/health-increase.html) | Sbed |
| `token` | [magic-swirl](https://game-icons.net/1x1/lorc/magic-swirl.html) | Lorc |
| `idle` | [hourglass](https://game-icons.net/1x1/lorc/hourglass.html) | Lorc |
| `combat` | [crossed-swords](https://game-icons.net/1x1/lorc/crossed-swords.html) | Lorc |
| `elite` | [crowned-skull](https://game-icons.net/1x1/lorc/crowned-skull.html) | Lorc |
| `rest` | [campfire](https://game-icons.net/1x1/lorc/campfire.html) | Lorc |
| `omen` | [hidden](https://game-icons.net/1x1/lorc/hidden.html) | Lorc |
| `boss` | [dragon-head](https://game-icons.net/1x1/lorc/dragon-head.html) | Lorc |

패널·버튼·바는 CSS로 만들었습니다.

## 사운드

없습니다. 무음으로 동작합니다.

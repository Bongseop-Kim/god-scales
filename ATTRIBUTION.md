# 사용한 자산

배포본에 실리는 자산의 상세 표(아이콘 28개 슬러그·저자 포함)는 [`public/ATTRIBUTION.md`](public/ATTRIBUTION.md)가 정본입니다. 이 파일은 저장소 쪽 요약입니다.

## 아이콘 — game-icons.net (CC BY 3.0) 28개

토큰 10 · 적 패시브 8 · 의도 5 · 지도 노드 5. 파일 28개가 아니라 `art/icons.svg` 한 장에 `<symbol>` 28개로 들어갑니다. Icons made by Lorc, Delapouite, Sbed, and Skoll (<https://game-icons.net>), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). 슬러그·저자 표는 `public/ATTRIBUTION.md`와 `tools/icons.ts`에 있습니다.

## UI

패널, 버튼, 바는 CSS로 직접 제작했습니다.

## 커서 · 파티클 — Kenney (CC0)

| 자리 | 팩 | 라이선스 |
|---|---|---|
| `art/cursor-pixel/` 3장 | [Cursor Pixel Pack](https://kenney.nl/assets/cursor-pixel-pack) | CC0 1.0 |
| `art/particle/` 81장 | [Particle Pack](https://kenney.nl/assets/particle-pack) | CC0 1.0 |

CC0이라 귀속 의무는 없습니다. 출처를 남기는 것은 예의이자 재수급 경로를 잃지 않기 위해서입니다.

**커서 3장은 모두, 파티클은 4장만 배포본에 들어갑니다.** 파티클 나머지는 저장소에만 있습니다.

## 그림 · 스프라이트

`art/` 아래 제작 에셋 83개(스프라이트 20 · 배경 6 · 프롭 14 · 카드 30 + 프레임 1 · 신 일러 5 · 컷인 3 · 주인공 3 · 마커 1)는 이미지 생성 도구로 프로젝트에서 직접 만들었습니다. 프롬프트 정본은 `art/_src/gen-docs.mjs`이고, 파일마다 옆에 놓인 `.md` 사이드카에 최종 프롬프트가 남아 있습니다. 파일이 없을 때는 CSS placeholder로 동작합니다.

## 사운드

| 종류 | 자산 | 출처 · 라이선스 |
|---|---|---|
| 배경음악 2곡 | `audio/Beneath_the_Iron_Altar.m4a` · `Beneath_the_Golden_Banner.m4a` | Gemini로 프로젝트에서 직접 생성 |
| 효과음 4개 | `chip-lay-3` · `card-slide-6` · `card-place-4` · `chips-handle-4` | [Kenney Casino Audio](https://kenney.nl/assets/casino-audio), CC0 1.0 |
| 효과음 5개 | `turn-end` · `enemy-death` · `guard` · `attack` · `hit` | [Mixkit Sound Effects](https://mixkit.co/free-sound-effects/), [Sound Effects Free License](https://mixkit.co/license/#sfx) |
| 신 대사 음성 | `audio/voice/*.m4a` | 로컬 [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)(12Hz-1.7B-CustomVoice)로 프로젝트에서 직접 생성 — 파이프라인은 `tools/tts.py` |

Kenney 효과음은 CC0이라 귀속 의무가 없지만 재수급 경로를 남깁니다.

## 폰트 — Galmuri11 (SIL OFL 1.1)

| 자리 | 파일 | 라이선스 |
|---|---|---|
| 화면 전체 | `ui/fonts/Galmuri11.woff2` · `Galmuri11-Bold.woff2` | [SIL OFL 1.1](ui/fonts/LICENSE.txt) |

Copyright (c) 2019–2025 Lee Minseo (quiple@quiple.dev).
받은 곳: <https://galmuri.quiple.dev>

OFL은 저작권 고지 유지를 요구합니다 — 위 고지와 `ui/fonts/LICENSE.txt`가 그 자리입니다.
폰트 파일 자체를 판매하지 않는 한 게임에 실어 배포할 수 있습니다.

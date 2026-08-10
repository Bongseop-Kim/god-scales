# 79 — 신 대사 음성(TTS) + 동시 발화 단일화

## Context

`data/gods.json`의 신 대사(총 448줄, 한글)를 음성으로 미리 생성해 두고, 게임에서 해당 대사가 화면에 뜰 때 음성을 함께 재생한다. 또한 지금은 조우 시작·개입 턴·융합에서 패트론 두 신이 각각 말해 텍스트가 2번 뜨는데(음성을 붙이면 소리도 2번), **우호도(favor)가 높은 신 하나만** 말하도록 바꾼다.

TTS 엔진: 처음 지목된 kokoro(`~/git/kokoro`)는 한국어 미지원(lang_code·음성 모두 없음)이라 사용자 확인 후 **`~/git/Qwen3-TTS`(Qwen3-TTS-12Hz-1.7B-CustomVoice)**로 확정. 한국어 정식 지원, 완전 로컬(MPS), 화자 9종.

## 현재 구조 (탐색 완료)

- 대사 선택·표시: `ui/shared/fx.ts` — `nextSpokenLine(god, text)`(83–88)가 한 줄 확정, `speak(level, god, text, portrait?)`(98–133)가 표시. **speak 호출 7곳 전부가 이 한 함수를 지난다.**
- 두 신 동시 발화 지점:
  - `ui/screens/combat.tsx:199-249` — `view.patrons.forEach`로 두 패트론이 1700ms 간격으로 각각 `speak`(:219) + 컷인 `playSprite`(:223)
  - `ui/app.tsx:135-136` — fuse 시 두 패트론이 320ms 간격으로 각각 `speak`
- 우호도: `view.favor: Record<string, number>` (0–100, `sim/engine.ts:266`), 단계 판정 `favorStage` (`core/favor.ts:86`)
- 오디오: `ui/shared/sfx.ts` — `import.meta.glob`으로 `audio/` 파일 자동 등록, `new Audio(url)` 재생, `sound.enabled` 전역 토글. 파일을 넣기만 하면 등록되는 구조.
- 대사 카테고리: staged(encounter/intervene/cross × 4단계) + flat(tear/join/reconcile/fuse/demand_*) + foes. `ui/app.tsx:157`의 과업 달성 대사는 숫자가 박힌 동적 문자열이라 **음성 제외**(텍스트만 유지).

## 변경 내용

### 1. TTS 배치 생성 스크립트 — `tools/tts.py` (신규)

Qwen3-TTS 리포의 venv(uv)로 실행하는 재생성용 파이썬 스크립트. npm 파이프라인과 무관.

- `data/gods.json`의 `lines` 아래 모든 문자열을 (god, text)로 수집 (staged/flat/foes 전부).
- 파일명 = **FNV-1a 32bit 해시**(UTF-8 바이트, 입력 `"{god}\0{text}"`)의 hex → `audio/voice/{hex}.mp3`. 텍스트가 바뀌면 해시가 바뀌므로 매니페스트 불필요·증분 생성 가능(이미 있는 파일은 skip).
- 모델: `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`, `device_map="mps"`, `attn_implementation="sdpa"`(flash-attn은 macOS 불가), `PYTORCH_ENABLE_MPS_FALLBACK=1`, `language="Korean"`, 배치 8줄씩 `generate_custom_voice`.
- 신별 화자 매핑 (한국어 네이티브는 Sohee 하나뿐이므로 남신은 타 화자 + Korean):

  | 신 | speaker | 근거 |
  |---|---|---|
  | zeus | Uncle_Fu | 노련한 저음 남성 |
  | poseidon | Ryan | 리듬감 있는 남성 |
  | ares | Eric | 허스키한 남성 |
  | athena | Serena | 따뜻한 여성 |
  | artemis | Sohee | 한국어 네이티브 여성 |

  1.7B는 `instruct` 지원 → 신별 톤 지시 한 줄씩(WRITING.md 성격 표 참조).
- 출력 wav(24kHz) → `ffmpeg`으로 mp3 변환(448개 ≈ 십수 MB). ffmpeg 없으면 `afconvert`→m4a로 대체하고 glob 확장자만 맞춘다.
- **본 생성 전 스모크 테스트**: 신별 1줄씩 5개만 생성해 비네이티브 화자의 한국어 억양을 귀로 확인. 어색하면 해당 신만 `Qwen3-TTS-12Hz-1.7B-VoiceDesign`(자연어 음성 묘사)으로 폴백 — 스크립트에 화자/모델 매핑만 바꾸면 됨.
- 448줄 전체 생성은 수십 분~수 시간(백그라운드 실행, 5줄 먼저 돌려 시간 추정).

### 2. 음성 재생 — `ui/shared/sfx.ts` + `ui/shared/fx.ts`

- `sfx.ts`: `audio/voice/*.mp3` glob 추가(파일명 그대로 키). `playVoice(god, text)` 추가 — TS로 동일한 FNV-1a 해시 계산(`TextEncoder`로 UTF-8 바이트, 파이썬과 동일 입력 `"{god}\0{text}"`), 파일 있으면 재생. **모듈 전역 HTMLAudioElement 1개** 재사용 — 새 발화가 이전 음성을 자연히 끊어서 `speak`의 「새 것이 낡은 것을 지운다」 규칙과 일치. `sound.enabled` 존중. 파일 없으면 침묵(404 없음 — glob이라 원천 차단).
- `fx.ts` `speak()`: `nextSpokenLine`으로 줄이 확정된 직후 `playVoice(god, selected)` 한 줄 추가. **호출부 7곳 전부 이 한 지점으로 커버.** 컷인 라벨(`playSprite`의 text)은 효과 설명 합성 문자열이라 음성 없음.

### 3. 동시 발화 → 우호도 높은 신 하나만

- `ui/screens/combat.tsx:199-249`: 두 패트론의 **효과 연출(파티클·흔들림)과 join 외침은 그대로 두고**, `speak` + 컷인(`playSprite` 라벨)은 「이번 훅에 effects가 있는 패트론 중 favor가 가장 높은 신」 하나만 실행. 동률이면 patrons 순서 앞. favor는 이미 `view.favor[god]`로 손에 있음(:207). 낮은 신의 컷인 텍스트는 사라지지만 효과 파티클·피해 표시는 남으므로 감수(요구사항).
- `ui/app.tsx:132-139` (fuse): 두 speak 중 favor 높은 패트론 것 하나만. favor는 fusion을 만든 최신 observation(`latest.current?.observation`)에서 읽고, 없으면 `fusion.patrons[0]`.
- `header.tsx:86`의 cross 동시 발화는 이미 `speak`의 교체 규칙 + 전역 voice Audio 1개로 텍스트·음성 모두 하나만 남음 — 코드 변경 없음.

## 검증

1. 해시 패리티: vitest 테스트 1개 — TS FNV-1a("zeus\0<실제 대사 한 줄>")의 hex가 파이썬 스크립트가 만든 파일명과 일치하는지 고정값으로 assert.
2. `npm test` — 기존 게이트 전부 통과 확인 (gods.json은 건드리지 않으므로 validate 영향 없음).
3. `aside` CLI로 브라우저 확인: 조우 시작 시 (a) 발화 텍스트가 한 신만 뜨는지, (b) 음성이 한 번만 나는지, (c) 사운드 토글 off 시 음성도 꺼지는지.
4. 완료 후 `reviews/79-tts-voice.md` 작성, 이 파일 삭제.

## 건드리는 파일

- 신규: `tools/tts.py`, `audio/voice/*.mp3` (~448개)
- 수정: `ui/shared/sfx.ts`, `ui/shared/fx.ts`, `ui/screens/combat.tsx`, `ui/app.tsx`, 해시 테스트 1개
- 불변: `data/gods.json`, 엔진(`core/`, `sim/`) — 리플레이·밸런스 게이트에 영향 없음(연출만 변경)

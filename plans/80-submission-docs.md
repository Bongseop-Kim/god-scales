# 80 — 공모전 제출 문서 2벌 (게임 소개 · AI 활용 기술)

## Context

**NAN 2026(NHN Game × AI Hackathon, https://nan2026.nhn.com/) 사전 과제** 제출용 문서 2벌을 PDF로 만든다. 채용 연계형 해커톤의 서류 심사(본선 10팀 선발)이고 심사자는 NHN의 게임·AI 엔지니어 — **문서 B(AI 활용)가 승부처**다. 본선에서 AI 에이전트 설계서·디렉팅 명세서를 요구하므로, 문서 B는 "AI를 파이프라인 전반에 구조적으로 부렸다"는 역량 증거로 구성한다. 문서 A는 게임이 실제로 돌아가고 완성돼 있음을 빠르게 보여주면 된다. 신청 마감 8/10.

- **문서 A — 게임 소개 및 설명**: 제목·한 줄 소개 / 게임 방법(목표·조작·종료 조건) / 실행 방법 / 플레이 링크 / 플레이 영상 링크. **짧게(4~6쪽), 게임 캡처 + 간단한 이미지 편집 중심.**
- **문서 B — AI 활용 기술 문서**: AI 활용 구조·주요 프롬프트·지시 사항 / 외부 에셋·오픈소스 출처. **집중적으로(8~12쪽).** 저장소에 이미 남아 있는 증거(프롬프트 원문, 게이트 코드, 회차 로그, 리뷰 인덱스)를 경로·수치와 함께 인용하는 구성.

플레이 영상은 사용자가 나중에 녹화 — 문서에는 자리표시자만. 제출 요강 1·2번 항목은 이 plan 범위 밖.

## 현재 구조 (탐색 완료)

문서에 쓸 재료는 전부 저장소에 있다.

- 게임 정본: `README.md`(룰 표·플레이 URL https://bongseop-kim.github.io/god-scales/), `seed/godscales-04-tech.md`(스택 표). 규모: 카드 179 · 은혜 45 · 적 19 · 층 12 · 신 5 · 합성 10종.
- 워크플로 증거: `CLAUDE.md`(7줄 헌법) · `WRITING.md`(신별 어미 표) · `UI.md`(레이아웃 불변) · plan 83건 소비 / `reviews/` 86건 잔존 · `reviews/00-index.md`(수치 전후표, 예: 무게 681.50MiB→2.39MiB).
- 콘텐츠 파이프라인: `prompts/*.md` 14종(`prompt_version` 태그, EV 공식) → `staging/` 35 JSON(재시도분 분리) → `tools/validate.ts` 9종 반려 코드 → `data/`. 회차 로그 `logs/generation/*.md`(pass_rate 0.8→v1.2 수정→1.0 사례). 게이트 명세는 `test/gate.test.ts`.
- AI 플레이·밸런싱: `sim/`(룰 봇 ε-탐욕 + LLM 봇), `decisions/001~010`(pending.json↔answer.json 프로토콜, 10런 완주·폴백 0), `tools/tune.ts`(winFloor 0.05만 테스트 잠금, releaseFloor 0.25 분리), `reports/final.md`(6회차 64,000런, 분산 0.0829→0.0353).
- 아트: `art/_src/gen-docs.mjs`(프롬프트를 코드로 조립), 이미지 1장당 사이드카 `.md`(카드만 359쌍), `art/_src/sprite-runs/` 38런(request→prompts→frames→qa), `art/README.md`(해상도 소실 사고 + 재발 방지 4규칙).
- 오디오·영상: Gemini 생성 BGM 2곡(`audio/*.m4a`) + 신 컷인 mp4 5개(`art/gods/*.mp4`). 신 대사 음성은 로컬 Qwen3-TTS(`~/git/Qwen3-TTS`, Qwen3-TTS-12Hz-1.7B-CustomVoice)로 생성 진행 중 — 파이프라인 정본은 P-79(신별 화자 매핑, FNV-1a 해시 파일명, `audio/voice/`).
- 코드 리뷰: CodeRabbit 리뷰를 받아 반영하는 사이클 병행.
- 출처: `ATTRIBUTION.md` — 단, **"사운드 없음" 기술이 현재 `audio/` 11개 파일과 불일치(낡음).**

## 변경 내용

### 0. 선행 정비 — `ATTRIBUTION.md` 갱신

"사운드 없음" 절을 실제 상태로 교체: BGM 2곡(Gemini 생성) + SFX 9개(출처 확인해 기입). 문서 B가 이 파일을 인용하므로 먼저 고친다.

### 1. `submission/` 디렉터리 (신규, 빌드·배포 무관)

- `submission/intro.html` · `submission/ai-tech.html` — 인쇄용 HTML(인라인 CSS, A4 `@page`, 이미지 로컬 상대경로).
- 캡처는 `aside` CLI로 촬영해 `submission/shots/`에 저장. 주석(화살표·라벨)은 HTML/CSS 오버레이로 — 별도 이미지 편집 툴 불필요.
- PDF 출력: `chrome --headless --print-to-pdf` 2회. 산출물 `submission/intro.pdf`, `submission/ai-tech.pdf`.

### 2. 문서 A — 게임 소개 및 설명 (4~6쪽)

1. **표지**: 「신들의 저울」 + 한 줄 소개("두 신을 후원자로 모시고 12층을 오르는 덱빌딩 로그라이크") + 키 비주얼(`art/gods/*.webp` 조합).
2. **게임 방법** (캡처 + 주석 2~3쪽):
   - 목표: 지하 6층 + 지상 6층 = 12층 완주.
   - 루프: 후원자 2신 선택(조합 10) → 층마다 3갈래(전투·정예·쉼터·과업) → 에너지 3 카드 전투 → 호의 4단계·신의 개입(3턴 주기) → 은혜 3택1 → 합성 카드 해금.
   - 조작: 마우스 클릭(카드 → 대상 지정).
   - 종료: 12층 완주 = 승 / 체력 0 = 패.
   - 규모 한 줄: 카드 179 · 은혜 45 · 적 19 · 합성 10종.
3. **실행 방법**: 플레이 URL(README 정본) + 로컬 `npm install && npm run dev` + 데스크톱 브라우저 권장.
4. **플레이 영상 링크**: 자리표시자 `(영상 링크)`.

### 3. 문서 B — AI 활용 기술 문서 (8~12쪽)

각 섹션에 실제 파일 경로·수치·프롬프트 발췌를 박는다. **문서를 관통하는 원칙 하나를 첫 장에 선언: "AI에게 시킨 모든 작업에는 검증 단계가 따른다."** 이후 각 섹션이 이 원칙의 사례가 되도록 배치 — 코드는 테스트+CodeRabbit+리뷰 문서, 콘텐츠는 `validate.ts` 게이트, 밸런스는 시뮬 게이트, UI는 aside 시각 검증, 아트는 qa 접촉시트, 음성은 스모크 테스트.

1. **개요 표**: 영역별 도구 — 코드·기획(Claude Code, GPT) / 코드 리뷰(CodeRabbit) / 게임 콘텐츠(LLM 생성 + 자동 게이트) / 이미지([sprite-gen](https://github.com/aldegad/sprite-gen) + GPT-image) / BGM·영상(Gemini) / 대사 음성(Qwen3-TTS 로컬) / 플레이테스트·밸런싱(LLM 봇 + 룰 봇) / 브라우저 E2E·시각 검증(aside). 각 행에 "검증 방법" 열을 붙인다.
2. **개발 워크플로 — plan→commit→review 사이클**: 플랜문서를 깃에 등록·커밋 → 수행 → `reviews/NN-*.md` → plan 삭제. 엿새간 83건 소비 / 86건 잔존, `reviews/00-index.md` 수치 전후표 발췌. 지시 규범 3종(CLAUDE.md 7줄 헌법 전문 인용 + WRITING.md 신별 어미 표 + UI.md 제1규칙). 커밋마다 **CodeRabbit 자동 리뷰**를 받아 반영 — 사람 리뷰어 없이도 AI 상호 검토가 도는 구조(작성: Claude/GPT, 검토: CodeRabbit).
3. **도구 철학**: 하네스 툴(OMC, Superpowers 등) 배제 — 모델 발달로 토큰 과소비·간단한 해결의 우회 경향. 스킬은 [ponytail](https://github.com/dietrichgebert/ponytail) 하나 + 각 도구 네이티브 기능 + plan별 effort 조절.
4. **콘텐츠 생성 파이프라인**: `prompts/` 14종(버전 태그·EV 공식·반송 키) → `staging/`(재시도분 분리 보존) → `tools/validate.ts` 9종 반려 코드(schema/dsl_parse/token_scope/fusion_scope/demand_axis/duplicate/value_outlier/passive_coverage/map_layout) → 통과분만 `data/`. 회차 로그의 pass_rate 개선 사례(0.8→1.0) 1건 상술.
5. **브라우저를 조종하는 AI — aside E2E·시각 검증** (비중 있게): 브라우저 확인·E2E를 aside CLI/에이전트로 일원화(CLAUDE.md 규칙). 용도 다각화 — (a) 12층 완주 E2E 자동 플레이 → 반출 JSON을 CLI 재생과 대조(`tools/e2e.ts`), (b) UI 변경마다 시각 검증(리뷰 문서의 「Aside 확인 (1440×900)」 절 + 캡처), (c) 특정 게임 상황을 만들어 확인하는 탐색 플레이(예: 부분 방어 팝 순서 검증 — 에이전트가 스스로 "방어 4를 가진 적"을 찾아 공격해 초록 방어량/빨간 피해 팝 표기를 확인). 실제 작업 장면 캡처(`~/Desktop/aside.png` → `submission/shots/`) 1장을 크게 싣는다 — 에이전트가 탭을 제어하며 단계별로 검증하는 화면.
6. **AI가 게임을 플레이한다**: `sim/` 헤드리스 엔진(브라우저와 `core/` 공유·결정적 시드) → LLM 봇 파일 프로토콜(`decisions/<run>/pending.json` 관측+합법수 ↔ `answer.json` 선택+이유, 무효 시 룰 봇 폴백) → 10런 완주·폴백 0. 밸런스 게이트: 조합 승률 하한 0.05 하나만 테스트에 잠금, 릴리스 목표 0.25는 분리(하한을 깎지 않는 원칙). 6회차 64,000런, 분산 0.0829→0.0353.
7. **아트 파이프라인**: 프롬프트를 코드로 조립(`gen-docs.mjs`) → 이미지 1장당 프롬프트 전문 사이드카 `.md` 보존 → 스프라이트 38런의 request→prompts→frames→qa 구조. 실패담: 해상도 소실 사고와 재발 방지 4규칙(`art/README.md`).
8. **오디오·음성·영상**: Gemini — BGM 2곡, 신 컷인 영상 5개. 신 대사 448줄 음성은 로컬 Qwen3-TTS(1.7B CustomVoice, 신별 화자 매핑 + WRITING.md 성격 표 기반 톤 지시)로 배치 생성 — 텍스트 해시 파일명으로 증분 재생성 가능한 구조(P-79). 문서 작성 시점의 진행 상태(완료/진행 중)를 그대로 명기.
9. **런타임 청정**: 배포물에 LLM 호출·API 키 0 — `DEPLOY.md` grep 게이트. LLM은 전부 빌드타임.
10. **외부 에셋 / 오픈소스 출처** (반쪽 표): 폰트 Galmuri11(OFL) · 커서/파티클 Kenney(CC0) · 도구 sprite-gen, ponytail, Qwen3-TTS — 갱신된 `ATTRIBUTION.md` 기준. 나머지 이미지·음악·영상·음성은 전부 AI 자체 생성임을 명시.

## 검증

1. PDF 2벌을 열어 레이아웃·이미지 해상도·쪽수(A 4~6, B 8~12)·링크 동작 확인.
2. `npm run build` 통과(submission/이 빌드에 안 섞이는지 확인), `git diff --check` 통과.
3. 완료 후 `reviews/80-submission-docs.md` 작성, 이 파일 삭제.

## 건드리는 파일

- 신규: `submission/intro.html`, `submission/ai-tech.html`, `submission/shots/*`, PDF 2벌
- 수정: `ATTRIBUTION.md`
- 불변: 게임 코드·데이터 전부

# P-18 · UI 연출과 에셋 배선

`plans/18-motion.md` · [◀ P-17](17-ui.md) · [색인](00-index.md) · [P-19 ▶](19-deploy.md)

**크기** 김 · **착수 조건** P-17 · **선행 준비** A-3의 에셋 다운로드와 `ATTRIBUTION.md`

직접 제작하는 에셋(카드 일러스트 · 스프라이트 시트 · 사운드)은 P-21에서 채운다. 여기서는 **없어도 완주하는지**를 검증한다.

---

## 완료 정의

넷 다 통과한다.

1. **연출 on 상태로 1런 완주 → 반출 → `--replay` 일치**
2. **`prefers-reduced-motion: reduce`에서 1런 완주.** 어느 적에게 무엇이 들어갔는지, 어느 토큰이 붙었는지가 읽힌다
3. **`art/cards/`를 비운 상태로 1런 완주.** 모든 카드가 placeholder로 폴백한다
4. **`art/fx/`와 `audio/`가 비어도 1런 완주.** 누락된 이펙트는 건너뛰고 누락된 소리는 나지 않는다

```bash
npm run dev
#   1. 연출 on → 1런 → 반출 → npm run sim -- --replay
#   2. DevTools 로 reduced-motion 강제 → 1런
#   3. mv art/cards art/cards.bak → 1런 → 복구
#   4. art/fx/ 와 audio/ 가 빈 상태로 1런
npm run art -- --check
```

---

## 산출

```
art/icons/            game-icons.net SVG 21종 (파일명에 제작자)
art/ui/               Kenney 패널 · 버튼 · 바
art/cards/            비어 있음 — P-21에서 채운다
art/fx/               비어 있음 — 스프라이트 시트 자리
audio/                비어 있음 — SFX 자리
ui/tokens.tsx         배지 9종 (아이콘 + 글자 + 스택)
ui/card.tsx           카드 컴포넌트 + placeholder 폴백
ui/motion.css         easing 변수, 연출 규격
ui/fx.tsx             스프라이트 재생 (없으면 건너뜀)
ui/sfx.ts             Web Audio 래퍼 + 음소거 (없으면 무음)
tools/art.ts          --list / --check
ATTRIBUTION.md
```

---

## 연출

**반복 빈도에 반비례해서 넣는다.** 전체 표는 A-2.6에 있다.

| 빈도 | 연출 |
|---|---|
| 카드 사용 (런당 ~100) | press `scale(0.97)` 120ms |
| 피해 숫자 (~200) | 대상 위에 팝 400ms |
| `chain` 파급 (~20) | 대상마다 60ms stagger |
| 합성 카드 획득 (0~1) | **가장 크게** |

**두 범주로 예산을 나눈다.**

| 범주 | 예산 | 수단 |
|---|---|---|
| UI 피드백 (고빈도) | **300ms 미만** | CSS transition · Motion |
| 극적 연출 (저빈도) | 480ms+ | 스프라이트 시트 (P-21) |

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);   /* 등장·소멸 */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* 화면 내 이동 */
```

- **`transform`과 `opacity`만 애니메이션한다.** HP 바는 `transform: scaleX()`
- 빠르게 반복 트리거되는 것(토큰 배지, 바)은 CSS transition으로 만든다

---

## 지시

### 연출을 core 상태의 diff에서 만든다

```
action dispatch → core 가 새 state 반환
                → 이전 state 와 diff
                → diff 를 연출 큐에 넣는다   ← 표현 상태
                → core 는 이미 다음 state
```

**연출 큐가 비지 않아도 다음 action을 받는다.** 다음 입력이 오면 진행 중인 연출을 즉시 완료시킨다.

### 라이브러리 — Motion 하나만

`motion/react`를 넣는다(A-2.7).

- **Motion은 exit 애니메이션에만 쓴다** — 화면 전환 crossfade · 손패 카드 퇴장 · 토스트 · 배너
- press 피드백, 배지 펄스, 바 트윈은 **CSS transition**으로 만든다
- 합성 카드 획득 같은 다단계 순차 연출은 **WAAPI** `await el.animate(...).finished`로 만든다

### 스프라이트 배선

`transform`으로 프레임을 넘긴다(A-2.8).

```css
.fx       { overflow: hidden; width: 256px; height: 256px }
.fx > img { animation: sprite 480ms steps(12) forwards }
@keyframes sprite { to { transform: translateX(-3072px) } }
```

`ui/fx.tsx`는 시트가 없으면 건너뛴다.

### 사운드 배선

`ui/sfx.ts` — Web Audio. 버퍼를 한 번 디코드하고 재생마다 `AudioBufferSourceNode`를 만든다. 첫 `pointerdown`에서 `ctx.resume()`으로 모바일 autoplay를 푼다. 파일이 없으면 무음으로 처리한다.

**음소거 스위치를 지금 만든다.** 기본값 켜짐, 첫 화면에서 끌 수 있게.

### 일러스트 규약

`art/cards/{card_id}.webp` 파일 규약으로 연결한다(A-2.3). 없으면 placeholder(신 색 그라디언트 + 신 아이콘 워터마크)로 폴백한다.

### 라이선스

game-icons.net은 CC BY 3.0이다. **아이콘을 받는 그 자리에서 파일명에 제작자를 기록한다**(`token-shock-lorc.svg`). `ATTRIBUTION.md`를 배포본에서도 접근 가능하게 한다.

**참조** — A-2.6~A-2.9, A-3, I-3

---

## 세션 종료

- [ ] 연출 on 상태에서 반출 → 재생 일치
- [ ] `prefers-reduced-motion`에서 1런 완주
- [ ] `art/cards/` 비어도 1런 완주
- [ ] `art/fx/` · `audio/` 비어도 1런 완주
- [ ] 음소거 스위치 동작
- [ ] `ATTRIBUTION.md` 작성, 배포본에서 접근 가능
- [ ] `npm run art -- --list` 동작
- [ ] 커밋

# P-60 · 스프라이트 상태 기계 — attack · hit · death

관련 [R-37](../reviews/37-wire.md) §1 「배포 스트립은 아홉 장이 아니라 idle 넉 장이다」 ·
[R-32](../reviews/32-art.md) · [art/README.md](../art/README.md) 규칙 5 · [P-58](../reviews/58-flourish.md) 피격 연출

## 배경

포즈는 **스무 캐릭터 전부 아홉 장씩 이미 있다.** 나가는 것은 넉 장(idle)뿐이다 —
R-37이 「재생하는 코드가 없다」는 이유로 잘랐고, 그 각주가 「상태 기계가 생기면 한 줄로
아홉 장이 된다」라 적어 뒀다. 이 계획이 그 상태 기계다.

P-58이 피격을 이미 연출한다 — 흰 플래시 · 셰이크 4px · 때린 쪽 20px 전진
(`ui/screens/combat.tsx:284`의 `view.hitSeq` 이펙트). **누가 때리고 누가 맞았는지를
그 이펙트가 이미 계산해 놓고 있다.** 지금은 그 정보로 통짜 idle 그림을 흔들 뿐이라,
칼을 뻗는 프레임과 뒤로 밀리는 프레임이 파일 안에서 잠들어 있다.

## 확인한 사실 — 새로 생성할 그림이 없다

`sprite-gen`을 다시 돌릴 필요가 없다. 실측:

| 자리 | 있는 것 |
|---|---|
| `art/_src/sprite-runs/{id}/` | 19종 4행 아틀라스(3584×4096) + `manifest.json.frame_layout` |
| `art/_src/sprites/{id}-strip.png` | **8064×1024 = 896 셀 아홉 장 가로 조립본** (19종) |
| `art/_src/player/{pose}.png` · `sprites/player-strip.png` | 병사 9포즈 · 10352×1368 조립본 |
| `art/sprites/{id}.webp` | **768×192 — 앞 넉 장만** (20종, 286K) |

셀 순서는 `sprite-request.json`의 `states` 순서와 같고 실제 그림으로 확인했다:
**idle 1~4 · attack 5~6 · hit 7 · death 8~9.** 병사도 같은 순서다.

그래서 §1은 생성이 아니라 **자르는 폭을 4셀에서 9셀로 늘리는 것**이다.

## 단계

### 1. 배포 스트립을 아홉 장으로 (에셋)

```
magick art/_src/sprites/{id}-strip.png -resize 1728x192! -quality 78 art/sprites/{id}.webp
```

스무 개 전부 같은 한 줄이다. 셀당 배율은 지금과 같고(896×1024 → 192×192) 그림은
안 바뀐다 — 폭만 768에서 1728이 된다. **입력은 `art/_src/`, 출력은 `art/`다**
(art/README.md 규칙 3). 원본은 한 픽셀도 안 건드린다.

### 2. CSS — `--cells` 하나와 포즈 넷 (`ui/motion.css`)

`.sprite`는 프롭(`Prop`, `Backdrop`)도 같이 쓴다. **프롭은 넉 장짜리 그대로다** —
그래서 셀 수를 변수로 빼고 기본값을 4로 둔다. 스트립이 늘어난 전투 배우만 9를 준다.

```css
.sprite img { width: calc(var(--sprite, 96px) * var(--cells, 4)); animation: sprite 1.2s steps(4) infinite; }
```

idle 키프레임은 **한 글자도 안 바뀐다** — 넉 장이든 아홉 장이든 idle은 앞 넉 칸이다.
포즈는 `data-pose`가 얹는 규칙 셋으로 붙인다:

| 포즈 | 셀 | 규칙 | 길이 |
|---|---|---|---|
| `attack` | 5~6 | `from -4 → to -5`, `steps(2, jump-none) forwards` | 250ms |
| `hit` | 7 | 애니메이션 없이 `translateX(-6칸)` 고정 | 200ms |
| `death` | 8~9 | `from -7 → to -8`, `steps(2, jump-none) forwards` | 500ms |

**`jump-none`이 여기서 중요하다.** 기본 `jump-end`로 `to`를 마지막 셀 다음 칸에 두면
`forwards`가 그 빈 칸을 붙잡아 캐릭터가 사라진다. `jump-none`은 시작·끝 셀을 둘 다
보여 주고 마지막 셀에서 멈춘다 — 죽은 적이 쓰러진 그림으로 남는 것이 이 한 단어다.

`prefers-reduced-motion` 블록에 `.sprite[data-pose] img { animation: none; transform: none; }`
한 줄을 더한다 — 지금 `.sprite img`를 세우는 줄과 같은 자리, 같은 이유다.

### 3. attack · hit — 이미 있는 이펙트에 붙인다 (`ui/screens/combat.tsx`)

`view.hitSeq` 이펙트가 이미 「맞은 노드」와 「때린 노드」를 다 찾아 놓았다. 그 자리에서
`node.dataset.pose`를 얹고 타이머로 지운다 — 새 상태도, 새 리렌더도 없다.

- 맞은 쪽(적·병사) → `hit` 200ms
- 적이 맞았으면 병사 → `attack` 250ms
- 병사가 맞았으면 직전 의도가 공격이던 적들 → `attack` 250ms

**타이머는 이펙트 cleanup이 걷는다** — 조우가 바뀌면 묵은 포즈가 남으면 안 된다
(같은 파일 컷인 이펙트의 `timers` 배열과 같은 모양). 줄인 모션은 이 이펙트가 이미
초입에서 반환하므로 포즈도 자동으로 안 붙는다.

CSS 선택자는 `[data-pose="hit"] .sprite img` 꼴이라 **`.sprite`에 ref를 새로 달지
않는다** — 포즈는 P-58이 플래시·셰이크를 거는 그 노드가 든다.

### 4. death — `useIsPresent()` 하나 (`EnemyButton`)

`EnemyButton`은 `useIsPresent()`를 이미 들고 있다(죽은 적을 e2e가 못 누르게 하려고
넣은 것). 퇴장 중이면 `data-pose="death"`다 — 조건이 이미 계산돼 있다.

퇴장 길이만 180ms → **500ms**로 늘린다(`exitPop`). 페이드는 뒤쪽에 몰아
쓰러지는 두 장이 보인 다음 사라지게 한다(`opacity: [1, 1, 0]`, `times: [0, .6, 1]`).
`mode="popLayout"`이 퇴장 노드를 흐름에서 빼 놓으므로 **판은 지금처럼 즉시 닫힌다** —
UI.md 제1규칙에 걸리지 않는다.

## 하지 않는 것

- **`sprite-gen` 재실행 없음 · 새 그림 생성 없음.** 아홉 포즈가 전부 `art/_src/`에
  최종 해상도로 있다. 다시 돌리면 캐릭터 정체성이 흔들릴 위험만 사고 얻는 게 없다.
- **병사 사망 포즈는 안 쓴다.** 체력 0이면 `CombatScreen`이 그 프레임에 언마운트되고
  `ResultScreen`이 뜬다 — 패배 화면은 이미 전면 일러(`hero("loss")`)와 프롭 셋을
  든다. 병사 쓰러지는 그림을 보이려면 앱 흐름에 지연 단계를 새로 만들어야 하는데,
  그건 이 계획이 사는 자리(전투 화면 안)가 아니다. 파일은 그대로 남는다.
- **프롭 9셀화 없음.** 프롭에는 attack도 death도 없다 — `--cells` 기본값 4가 그대로 산다.
- **`--frames` 같은 일반화 없음.** 포즈는 넷이고 셀 배치는 스무 파일이 전부 같다.
  R-37 §2가 안 만든 변수를 이번에도 안 만든다.
- 규칙·값·데이터·봇 불변. 밸런스 게이트 재측정 없음.

## 무게 — 이건 결정이 필요하다

측정치(`magick ... -quality 78`, 20종):

| | 스프라이트 | 번들 합계 |
|---|---:|---:|
| 지금 (4셀) | 286K | **4.42 MiB** |
| 이후 (9셀) | 749K | **4.87 MiB** |

`tools/size.ts`의 상한은 4 MiB다. **이 계획 전에 이미 넘어 있다** — `npm run size`는
지금 exit 1이고, CI가 그걸 안 돌려서 표가 안 났다(`.github/workflows/pages.yml`은
`test` · `stats` · `build`만 돈다). 이번 변경이 +463K를 더한다.

품질을 깎아도 얼마 안 준다(q65 669K · q55 637K) — 셀이 다섯 늘어난 값이라 압축으로
못 메운다. **상한을 손대는 것은 이 계획의 권한이 아니다.** §1을 하기 전에 셋 중
하나를 사용자에게 확인받는다:

1. 그대로 싣고 상한 초과를 리뷰에 적는다(현행 4.42도 초과다 — 이미 있는 빚이다).
2. 상한을 실측에 맞춰 올린다.
3. 다른 데서 뺀다 — 제일 큰 덩어리는 `art/cards` 129장 1271K다(장당 상한 40K).

## 완료 정의

- 스무 파일이 1728×192이고 `art/_src/` 원본은 안 바뀐다.
- 전투에서 병사가 칼을 뻗고, 맞은 쪽이 뒤로 밀리고, 죽은 적이 쓰러진 뒤 사라진다.
- 프롭·배경 스프라이트는 **눈에 띄는 변화가 없다**(넉 장 그대로).
- `prefers-reduced-motion`에서 포즈가 전부 꺼지고 idle 첫 장으로 선다 — 정보 손실 없음.
- e2e 완주. 클릭 계약(`data-enemy` · `disabled`)이 안 바뀐다 — 다만 퇴장 180→500ms라
  **완주 시간이 한도 안인지 확인한다**(적 하나당 320ms × 조우당 최대 4).

## 검증

```text
npx tsc --noEmit
npm test
npm run art            # 스무 장 다 있는지 (dimension은 안 본다 — 아래 한 줄로)
for f in art/sprites/*.webp; do magick identify -format '%wx%h %f\n' "$f"; done | grep -v '^1728x192' 
npm run size           # 위 §「무게」의 결정대로
npm run e2e            # aside CLI — 퇴장 500ms가 완주 시간에 미치는 영향
```

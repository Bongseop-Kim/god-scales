# R-60 · 스프라이트 상태 기계 — attack · hit · death

관련 P-60(삭제됨) · [R-37](37-wire.md) · [R-58](58-flourish.md) ·
[art 규칙](../art/README.md) · [UI](../UI.md)

**통과 · 완료 정의 전부 충족.** 스무 전투 배우의 배포 스트립이 idle 4 · attack 2 · hit 1 ·
death 2의 아홉 셀이 됐다. 새 그림·새 상태·새 ref는 없다. P-58 피격 이펙트가 이미 찾던 DOM 노드와
`EnemyButton`의 `useIsPresent()`를 그대로 썼다. 규칙·값·데이터·봇은 건드리지 않아 밸런스는 재지 않았다.

## 구현

- 일반 배우 18개는 **4032×448**, 두 칸 보스 둘은 **8064×896**이다. `art/_src/` 원본은 바꾸지
  않고 각 포즈의 비율을 유지한 채 정사각형 투명 여백에 맞춰 `+append`했다.
- `.sprite`의 셀 수는 `--cells` 기본값 4다. 프롭·배경은 그대로고 전투 배우만 9다. idle 키프레임도
  그대로라 앞 네 칸만 반복한다.
- `attack`은 5~6번 250ms, `hit`은 7번 200ms 고정, `death`는 8~9번 500ms다. 두 프레임 원샷은
  `steps(2, jump-none) forwards`라 마지막 셀 뒤의 빈칸으로 넘어가지 않는다.
- 피격 이펙트가 맞은 쪽에 `hit`, 공격자에 `attack`을 붙인다. 타이머와 붙인 노드 모두 effect cleanup이
  걷어 조우가 바뀐 뒤 포즈가 남지 않는다.
- 퇴장 중인 적은 `useIsPresent()`의 기존 값으로 `death`를 받고, `popLayout`은 판을 즉시 닫는다.
  opacity와 scale은 60%까지 유지한 뒤 사라진다. reduced motion에서는 포즈 animation과 transform이
  모두 꺼져 idle 첫 셀로 선다.

## 에셋 무게

19개는 q78로 파일당 상한을 통과했다. `enemy_surface_boss`만 q78에서 359,890바이트였으므로 해상도를
낮추지 않고 `cwebp -q 40 -m 6 -alpha_q 50`으로 **202,748바이트**까지 줄였다. `aside`에서 실제
448px 표시 크기로 attack·hit·death 다섯 셀을 확인했고 눈·윤곽·무기 디테일이 유지됐다.

## 검증

| 게이트 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 |
| `npm test` | 24파일 · **180테스트** 통과 |
| `npm run art -- --check` | made **249/249** · sprites **20/20** · 대조 위반 0 |
| 스프라이트 dimension | 4032×448 **18개** · 8064×896 **2개** |
| `npm run size` | **6.46/8 MiB** · 위반 0 |
| `npm run e2e` | `aside`로 239결정 · 10 phase · 12/12층 완주 · 가로 넘침 0 |
| `git diff --check` | 통과 |

계획의 `npm run art`는 현재 CLI가 인자를 요구해 종료 코드 1이었다. 실제 검증 명령인
`npm run art -- --check`로 확인했다. 실제 전투 DOM에서도 병사·적의 `attack`과 양쪽 `hit` 포즈 및
각 CSS animation 이름을 `aside`로 관측했다.

## 안 지은 것

- sprite-gen 재실행, 새 그림, 병사 사망 지연 화면 없음.
- 프롭 9셀화, 포즈용 React 상태, 전용 컴포넌트, `--frames` 일반화 없음.
- 새 지표·밴드·회차 비교 없음.

## 사후 수정 — player 크로마키

첫 조립은 불투명 녹색인 `art/_src/player/*.png`에 투명 여백만 붙여 녹색 배경을 배포본에 남겼다.
`art/sprites/player.md`의 기존 변환 그대로 `-alpha on -fuzz 35% -transparent '#00ff00'`을 resize보다
먼저 적용해 아홉 포즈를 다시 조립했다. 결과는 4032×448 · 130,474바이트 · 투명 모서리이며,
`aside`에서 idle·attack·hit·death를 실제 224px로 확인해 녹색 잔상과 외곽선 손실이 없었다.
`npm run size`는 **6.47/8 MiB · 위반 0**이다.

## 사후 수정 — 신의 피해를 병사의 공격으로 오인했다

첫 구현은 `view.hits`에 적이 있으면 언제나 병사에게 `attack`을 붙여 신의 헌신 개입에도 병사가 칼을
휘둘렀다. `recordHits`의 세 호출부가 이미 출처를 아는 자리라 관측에 `hitSource` 하나만 실었다:
공격 카드 `attack` · 비공격 카드 `card` · 신 개입 `favor` · 적 턴 `enemy`. 맞은 쪽의 `hit`은
출처와 관계없이 유지하고, 병사 `attack`은 `attack`, 적 `attack`은 `enemy`에서만 재생한다. 엔진
테스트가 세 출처를 같은 전투에서 순서대로 잠근다. 전체 180테스트와 `aside` E2E 239결정 완주가
통과했다.

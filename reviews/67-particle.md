# R-67 · 파티클이 움직인다 — 스트립 스무 장 · 튀는 자리 교정

[P-67] 수행 결과. **규칙·값·데이터·봇·밸런스 게이트는 바꾸지 않았다.** 기존 `playSprite`의 4프레임
경로와 전투 DOM의 `[data-enemy]`를 그대로 썼고, 파티클 엔진·풀·큐는 만들지 않았다.

## 한 일

- `tools/particles.ts`가 케니 PNG 80장을 겹침 없이 네 장씩 묶어 20개 스트립을 굽는다. 셀은 상수
  `192`, 출력은 768×192 WebP다. `npm run particles`만 추가했다.
- `particleStrip` 한 표가 카드의 갈래 4 × 신 5와 신 개입을 함께 고른다. 카드에 모르는 신이 오면 그
  갈래 첫 그림으로 떨어진다.
- 적 선택도 `play()`를 지나 `aimed`에 남는다. 카드 파티클은 자기 대상이면 병사, 지정 대상이면 그
  `[data-enemy]`, 전체 대상이면 DOM에 남은 적 노드 전부에 붙는다. 그래서 퇴장 중인 막타 대상도 잡힌다.
- 옛 512×512 정지 WebP 넷은 삭제했다. `playSprite`와 `motion.css`는 바꾸지 않았다.

## 에셋 실측

| 항목 | 결과 |
|---|---:|
| 스트립 | 20장 |
| 규격 | 전부 768×192 |
| 합계 | 509,226B (497.3KiB) |
| 최대 | `scorch.webp` 52,276B |
| 원본 사용 | PNG 80장, 중복 0 |

## `aside` 전투 실측

시드 32에서 제우스·아테나 커스텀 덱을 실제 클릭해 첫 조우를 돌렸다.

| 확인 | 실측 |
|---|---|
| 3번 칸 지정 | `enemy_under_zealot` 안에 `spark`가 붙었다. host 중심 1236px, 판 중심 720px라 판 가운데가 아니다. |
| 스트립 재생 | DOM `fx spark strip`, 원본 768×192, `steps(4)`·800ms. transform x는 0 → −192 → −384 → −576px로 걸었고 850ms 표본에서 제거됐다. |
| 막타 | `enemy_under_brute`가 `data-pose="death"`인 동안 `muzzle`이 그 노드에 붙었다. |
| 전체 대상 | 산 적 3명일 때 `card_athena_25`의 `muzzle`이 슬롯 0·1·2에 각각 한 장씩, 총 3장 붙었다. |
| 개입·자기 대상 | 적 대상 개입 `ember`는 slot 0 = front slot에서, 자기 대상 `flame`·`glint`·`star`는 병사에서 튀었다. |
| 서로 다른 그림 | 한 조우에서 카드 파티클 `spark`·`muzzle`·`flame`·`glint`·`star` 5종을 실제 로드했다. |

## 검증

| 명령 | 결과 |
|---|---|
| `npm run particles` | 20개 생성 |
| `npm run art -- --check` | missing 0 · 대조 위반 0 · 249/249 |
| `npx tsc --noEmit` | 통과 |
| `npm test` | 24파일 187테스트 통과 (4×5 매핑 검사 1개 추가) |
| `npm run e2e` | `aside` 239결정 완주 + 자유 덱 39결정 · 전 항목 통과 |
| `git diff --check` | 통과 |
| `npm run size` | 개별 위반 0, 총량 8.96/8MiB로 exit 1 |

총량 적색은 계획 전 8.60/8MiB였던 기존 자리에서 0.36MiB 늘어난 값이다. 이 계획의 파티클 한도
500KiB는 지켰고, 별도 총량 수정이나 새 지표는 만들지 않았다.

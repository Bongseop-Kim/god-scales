# R-55 · 전투 무대형 재배치

`reviews/55-battle-stage.md` · [색인](00-index.md) · 관련 [R-54](54-statusbar.md) · [R-41](41-cardface.md) · [R-35](35-range.md)

## 결론

**통과 · 완료 정의 전부 충족.** 전투의 패널 상자 둘(`.enemy-panel`·`.decision-panel`)이 사라지고
배경(.38 → **.55**)이 무대가 됐다. 병사 192 · 적 160이 같은 지면선에 서고, 의도·체력·토큰이
캐릭터에 붙는다. **규칙·관측·답은 한 글자도 안 바뀌었다** — 같은 결정을 다른 배치로 그릴 뿐이다.
e2e가 시드 727을 완주해 클릭 계약(`button`·`data-*`) 불변을 증명한다.

## 구현

- **무대** — `.stage-field` 위 절대 배치. 병사 왼쪽(x 154 + 192), 적은 `--slot`·`--span` CSS 변수
  하나가 자리를 정한다(`left: 380px + slot × 190px + (span−1) × 95px`) — `m.button layout`이
  변수 변화(밀림·맞바꿈)를 그대로 미끄러뜨리므로 P-36의 이동 애니메이션이 공짜로 산다.
  스프라이트 크기는 `--sprite` 변수 하나로 갈랐다(`motion.css`) — keyframes의 var는 요소별로
  풀리므로 4프레임 steps 루프가 96·160·192에서 같은 코드다. 빈 칸은 바닥 점선 타원 —
  칸 이름 글자는 색만 죽여 DOM에 남긴다(테스트·SR 아리아가 읽는다)
- **상태가 캐릭터에** — 의도는 머리 위 아이콘 16 + 숫자만(`intentBits`), 문장형 `intentLabel`은
  `aria-label`과 `title`로 물러났다. 이름도 hover/focus에서만. 체력 바 140×16 발밑, 그 아래
  방어·패시브·토큰 칩 한 줄(자리 예약 — 첫 칩에 이웃이 안 밀린다). 적 버튼 계약은 현행 그대로:
  `disabled`·`aria-label`·`data-enemy`·`popLayout`·`useIsPresent`
- **하단** — 좌하단 에너지 젬 72px(숫자만 · 우하 작은 원에 `ENERGY_PER_TURN` · 0이면 무채색),
  그 아래 뽑을 카드 더미(CSS 카드 스택 + 숫자). 「에너지」·「뽑을 카드」 글자 라벨 삭제 —
  `aria-label`에만 남는다. 손패 부채꼴은 기하 그대로 하단 중앙, 무대 카드는 그 위. 턴 종료는
  우하단 `.primary.end-turn` 160×46(P-54 케니 스킨 재사용) — e2e의 클릭 후보 선택자만
  `.decision-panel button.primary` → `button.end-turn`으로 갱신했다
- **대상 선택** — 커서가 케니 `crosshair-030` 32px 사본(핫스팟 중앙 16,16 — 원본 148px은
  커서로 못 쓴다), 가리킨 적 위에 `crosshair-167` 링 + 이름. 배경은 `aim` 톤(.55 → .35),
  비대상은 `brightness(.55)`. `.fan.aiming`(손 전체 물러남) 유지
- **약속·파워 칩** — 상태 바 바로 아래 좌측 `board-chips`. 약속 칩이 `<button>`이 되어 저널
  (P-53)을 연다(`onOpenJournal` prop 하나 — 오버레이 상태는 App이 든다)
- **프롭 3겹 5개** — `Backdrop`의 시드 픽 2 → 5(오프셋 `i×3`이 mod 7에서 전부 다른 칸).
  원경 2(작게 48px, 상단) · 중경 1(96px, 적 뒤) · 전경 2(128px, 발밑, blur 1px). 위치는 겹별
  범위 안에서 층 시드로 셔플된다
- **컷인·파티클** — `hostsFor`의 ref만 무대 컨테이너(`stage-field`)와 병사 배우로 옮겼다.
  `data-enemy` 훅 불변이라 개입 파티클이 그대로 맞는 대상 위에서 터진다

## 하지 않은 것

- 새 애니메이션 없음 — lunge·턴 배너·화살표는 P-58이다. 이 플랜은 배치만
- `PlayerActor`의 호의 미터 없음 — P-54의 상태 바가 이미 든다(중복 표시 금지)
- 모바일·터치 대응 없음. `--fit` 축소가 계속 정본이다

## 검증

```text
npx tsc --noEmit    통과
npm test            24파일 · 179테스트 통과 (보스 단언을 grid-row → `--slot:0;--span:2`로)
npm run e2e         e2e ok — 시드 727 완주, 대상 선택 경로 포함, 아홉 화면 넘침 없음
aside 실측          무대 배치(병사 192 · 적 4 + 의도 아이콘 · 발밑 체력 바·칩) ·
                    에너지 젬/더미 · 턴 종료 케니 버튼 · target 단계 무대 카드 + 손 물러남
```

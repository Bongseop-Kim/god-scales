# 신들의 저울

브라우저에서는 네 번의 갈림길을 선택하고, 전투는 결정론적 룰 봇이 자동으로 진행하는 덱빌딩 프로토타입입니다.

배포 예정 URL: <https://bongseop-kim.github.io/god-scales/>

현재 저장소 지침상 커밋·푸시를 수행하지 않았으므로, 위 URL은 기본 브랜치 반영 및 GitHub Pages 활성화 후 열립니다.

## 실행과 플레이

Node.js 22에서 의존성을 설치하고 개발 서버를 실행합니다.

```bash
npm install
npm run dev
```

터미널에 표시된 주소(기본 `http://localhost:5173`)를 열고 다음 순서로 플레이합니다.

1. 정수 시드를 입력하고 `런 시작`을 누릅니다.
2. 지하 3·5층, 지상 3·5층에서 `전투` 또는 `휴식`을 고릅니다.
3. 네 번 선택하면 자동 전투 결과와 최종 체력·호의가 표시됩니다.
4. `런 JSON 반출`로 재생 파일을 내려받을 수 있습니다.

CLI 플레이는 아래처럼 실행합니다. 시드와 네 경로를 차례로 입력하면 `logs/human/run-{seed}.json`이 생성됩니다.

```bash
npm run play
npm run sim -- --replay logs/human/run-1.json
```

## 검증

```bash
npm test
npm run build
npm run art -- --list
npm run art -- --check
npm run size
npm run sim -- --replay logs/human/*.json
npm test -- dsl
npm test -- combat
```

## 시뮬레이션

```bash
npm run sim -- --runs 200
npm run sim -- --runs 1 --log
```

## 콘텐츠 검증

```bash
npm run validate -- core/__fixtures__/broken/
npm test -- gate
npm run validate -- staging/cards-zeus.json --apply
npm run validate -- staging/cards-zeus-retry.json --apply
npm test -- favor
npm run sim -- --runs 1000 --stratified
npm run sim -- --runs 500
npm run sim -- --runs 200 --scenario grace_6
npm run validate -- staging/enemies-underworld.json --apply
npm run validate -- staging/fused-*.json --apply
npm run sim -- --runs 200 --scenario fused_deck
npm run play
npm run sim -- --replay logs/human/run-1.json
npm run sim -- --runs 2000 --stratified
npm run report -- --heatmap
npm run tune -- --iteration 1
npm run sim -- --actor llm_agent --run-id 001
npm run sim -- --actor llm_agent --run-id 001 --resume
npm run report -- --compare rule_bot llm_agent
npm run tune -- --iteration 2
npm run tune -- --iteration 3
npm run report -- --rounds 1,2,3
```

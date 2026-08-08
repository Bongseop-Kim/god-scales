# Strike fx QA

- `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했고 이 run을 파일럿으로 먼저 완주했다.
- 1536×960 셀 4장, 8fps 원샷. 낙하 → 착탄 → 최대 불꽃 → 잔불이 한 동작으로 이어진다.
- projection + YCbCr 추출과 atlas는 `ok: true`, edge/chroma-adjacent pixel은 0이다. 마지막 프레임 크기 경고(790 vs 9328)는 잔불만 남는 동작 명세와 일치해 수용했다.

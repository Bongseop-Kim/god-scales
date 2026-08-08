# Strike fx QA

- `sprite-gen`의 `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 굵은 백색 낙뢰의 낙하 → 착탄 → 최대 불꽃 → 잔불이 한 동작으로 이어진다.
- projection + RGB 추출 후 1.15배 중앙 확대했다. `#10131c` 배경 접촉 시트와 atlas·inspect에서 오류·경고 없이 통과했다.

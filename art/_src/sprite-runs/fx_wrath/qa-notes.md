# Wrath fx QA

- `sprite-gen`의 `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 중명도 적색 손·압착판·사슬이 단계적으로 내려오며 주황 외곽광을 유지한다.
- projection + RGB 추출 후 2.5배 확대·상단 정렬했다. `#10131c` 배경 접촉 시트와 atlas·inspect에서 오류·경고 없이 통과했다.

# Anger fx QA

- `sprite-gen`의 `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 굵고 불투명한 주황 균열이 중앙에서 화면 전역으로 퍼진다.
- projection + RGB 추출 후 2.1배 확대·상단 정렬했다. `#10131c` 배경 접촉 시트와 atlas·inspect에서 오류·경고 없이 통과했다.

# Devotion fx QA

- `sprite-gen`의 `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 하나로 연결된 금빛 상단 광원에서 다섯 빛기둥이 순서대로 내려온다.
- projection + YCbCr 추출 후 1.65배 확대·상단 정렬했다. `#10131c` 배경 접촉 시트와 atlas·inspect에서 오류·경고 없이 통과했다.

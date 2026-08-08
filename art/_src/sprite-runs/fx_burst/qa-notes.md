# Burst fx QA

- `sprite-gen`의 `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 흰색·금색 광륜이 두꺼운 불투명 중심부를 유지하며 바깥으로 팽창한다.
- projection + RGB 추출 후 1.55배 중앙 확대했다. `#10131c` 배경 접촉 시트와 atlas·inspect에서 오류·경고 없이 통과했다.

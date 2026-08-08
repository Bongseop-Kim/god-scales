# Burst fx QA

- `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 재생성해 추출 가능한 연속 광륜과 그 위의 입자로 고정했다.
- 1536×960 셀 4장, 8fps 원샷. 광륜이 바깥으로 팽창하고 중앙은 모든 프레임에서 비어 있다.
- projection + YCbCr 추출, atlas·inspect 모두 `ok: true`; edge/chroma-adjacent pixel은 전 프레임 0이다.

# Calm fx QA

- `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 화면 가장자리의 숨결이 미세하게 팽창·수축하고 중앙은 비어 있다.
- projection + YCbCr 추출, atlas·inspect 모두 `ok: true`; edge/chroma-adjacent pixel은 전 프레임 0이다.

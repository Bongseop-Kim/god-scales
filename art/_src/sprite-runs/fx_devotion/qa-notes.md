# Devotion fx QA

- `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 빛기둥이 순서대로 내려오며 형태·광원이 이어진다.
- projection + YCbCr 추출, atlas·inspect 모두 `ok: true`; edge/chroma-adjacent pixel은 전 프레임 0이다.

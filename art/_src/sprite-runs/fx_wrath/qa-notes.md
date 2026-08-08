# Wrath fx QA

- `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 생성했다.
- 1536×960 셀 4장, 8fps 원샷. 손과 사슬의 압력이 아래로 진행하며 탁한 적색 형태가 유지된다.
- projection + YCbCr 추출과 atlas는 `ok: true`, edge/chroma-adjacent pixel은 0이다. inspect의 낮은 motion 경고(0.0013)는 중앙을 비운 제한된 실루엣 면적 때문이며 접촉 시트의 진행 동작으로 수용했다.

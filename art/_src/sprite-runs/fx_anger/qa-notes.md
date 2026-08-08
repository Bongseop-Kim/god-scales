# Anger fx QA

- `codex` 이미지 백엔드로 최종 `prompts/play.txt`를 재생성해 마젠타가 섞이지 않은 흰 균열로 고정했다.
- 1536×960 셀 4장, 8fps 원샷. 접촉 시트에서 균열이 네 프레임에 걸쳐 퍼지는 것을 확인했다.
- projection + YCbCr 추출과 atlas는 `ok: true`, edge/chroma-adjacent pixel은 0이다. inspect의 낮은 motion 경고(0.0052)는 가느다란 균열이 화면 면적의 극소부만 차지해서 발생하며 시각 QA로 수용했다.

# P-19 · 배포와 반출

`plans/19-deploy.md` · [◀ P-18](18-motion.md) · [색인](00-index.md) · [P-20 ▶](20-rounds.md)

**크기** 짧음 · **착수 조건** P-18

---

## 완료 정의

- 배포 URL에서 1런을 완주한다
- 빌드 산출물에 API 키 문자열과 `tools/` 코드가 없다
- 반출한 JSON이 `logs/human/`에 들어가 집계에 합쳐진다

```bash
npm run build
grep -rE "sk-ant|ANTHROPIC_API_KEY" dist/        # 결과 없음
grep -rl "validate\|tune" dist/                   # 결과 없음
# 배포 후
curl -sI <배포 URL> | head -1                     # 200
npm run sim -- --replay logs/human/*.json
```

---

## 산출

```
dist/            정적 빌드
logs/human/      반출된 사람 런
README.md        배포 URL, 실행 방법, 검증 명령 전체
```

---

## 지시

- LLM 호출을 `tools/` 아래 빌드타임 경로에만 둔다(T-1). 위 grep 두 줄로 확인한다
- 배포 대상은 A-1.1에서 미리 정한 URL을 쓴다
- **사람 플레이테스트 2회차를 여기서 돌린다**(A-4). 배포본 동작 확인이 목적이며 전역 파라미터 조정에는 쓰지 않는다. 체감 기록만 남긴다
- 배포 직후부터 **매일 1런을 돌려 B-0의 4번 조건을 채운다**

**참조** — T-1, T-1.1, I-1, A-1.1, B-0

---

## 세션 종료

- [ ] 배포 URL 1런 완주
- [ ] grep 두 줄 통과
- [ ] `README.md`에 배포 URL과 전체 검증 명령
- [ ] 사람 런 2회차 반출 및 집계 합류
- [ ] 커밋

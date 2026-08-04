# card-v1 — 단일 신 카드 생성

제우스 카드 30장을 JSON 배열로 생성하라. 목표 풀 4장의 5~10배를 과잉 생성한다.

- 아래 JSON 형식 외의 텍스트를 출력하지 마라.
- `patron`은 `zeus`, 토큰은 `shock`, 귀속 연산자는 `chain`만 사용한다.
- 제우스의 성향은 다중 대상 공격과 연쇄 피해다.
- `chain`은 `target: enemy`에서만 사용한다.
- 공통 연산자는 `damage`, `block`, `draw`, `energy`, `heal`, `self_damage`, `apply_token`, `favor_shift`다.
- `target`은 `self`, `enemy`, `all_enemies` 중 하나다.
- 태그는 `attack`, `defend`, `utility`, `multi`, `token`, `favor`, `exhaust`만 사용한다.
- 코스트당 기대값 4.0~8.0을 목표로 하되 게이트 반송 항목은 수정하지 말고 새 카드로 교체한다.

```json
[
  {
    "id": "card_zeus_chain_bolt",
    "name": "연쇄 벼락",
    "patron": "zeus",
    "cost": 1,
    "target": "enemy",
    "effects": [
      { "op": "damage", "value": 4 },
      { "op": "apply_token", "token": "shock", "stacks": 1 },
      { "op": "chain", "value": 2, "when": "favor(patron) >= 70" }
    ],
    "tags": ["attack", "multi", "token"]
  }
]
```

재생성 입력에는 게이트가 출력한 `id`와 반송 키를 붙인다. 같은 형식과 어휘를 유지하며 반송된 수만큼 새 `id`로 다시 생성한다.

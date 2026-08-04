# demand-v1 — 신의 요구 생성

한 번에 한 신의 요구만 JSON 배열로 생성하라. JSON 외의 텍스트를 출력하지 마라.

```json
{
  "id": "demand_zeus_multi",
  "patron": "zeus",
  "condition": "hit_targets_in_turn >= 3",
  "axis": "target_spread",
  "polarity": "+",
  "min_enemies": 3
}
```

- `axis`: `target_spread`, `damage_taken`, `turn_economy`, `token_load`
- `polarity`: `+`, `-`
- 라이벌 신에는 같은 축의 반대 극성 요구를 만든다.
- 각 신에 `min_enemies <= 1` 요구를 최소 하나 만든다.
- `reward`와 `penalty` 필드는 만들지 않는다. 관계에 따른 전역 규칙으로 런타임에 계산한다.

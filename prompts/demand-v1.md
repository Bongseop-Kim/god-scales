# demand-v1 — 신의 요구 생성

한 번에 한 신의 요구만 JSON 배열로 생성하라. JSON 외의 텍스트를 출력하지 마라.

```json
{
  "id": "demand_zeus_multi",
  "patron": "zeus",
  "axis": "target_spread",
  "polarity": "+",
  "min_enemies": 2,
  "tiers": [
    {
      "text": "물러서지 마라. 한 턴에 둘은 맞아야 한다.",
      "condition": "hit_targets_in_turn >= 2",
      "reward": { "favor": 12 }
    },
    {
      "text": "한 번의 벼락으로 셋을 쳐라. 흩어진 적에게 자비를 두지 마라.",
      "condition": "hit_targets_in_turn >= 3",
      "cost": { "favor": 18, "maxHp": 8, "encounters": 2 },
      "reward": { "grace": 1 }
    }
  ]
}
```

- `axis`: `target_spread`, `damage_taken`, `turn_economy`, `token_load`
- `polarity`: `+`, `-`
- 라이벌 신에는 같은 축의 반대 극성 요구를 만든다.
- 각 신에 `min_enemies <= 1` 요구를 최소 하나 만든다.
- **단은 정확히 둘이다** — 대가 없는 수락과 선불 대가가 붙은 시련. 셋으로 늘리지 않는다.
- 두 단은 같은 사실을 재고 임계가 극성 방향으로 움직인다: `-`면 내려가고 `+`면 올라간다.
- 시련의 보상이 수락보다 커야 하고(`grace` > `favor`), 대가는 필드마다 크거나 같고 어딘가는 실제로 커야 한다.
- `cost.maxHp`를 쓰면 `cost.encounters`도 1 이상 적는다. 대가는 **크기**로 적는다(부호 없음).
- 관계 벌금(`rivalDemandPenalty` −18 / `nonRivalDemandPenalty` −9)은 만들지 않는다. 지켰을 때
  런타임이 관계표로 계산한다 — `cost.favor`는 그것과 별개인 **선불**이고 관계표를 타지 않는다.

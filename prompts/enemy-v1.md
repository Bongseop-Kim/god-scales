# enemy-v1 — 적과 조우 생성

지역 하나의 적과 조우 편성을 JSON 배열로 생성하라. JSON 외의 텍스트를 출력하지 마라.

```json
{
  "id": "enemy_under_pressure",
  "name": "저승의 추격자",
  "region": "underworld",
  "tier": "normal",
  "role": "pressure",
  "hp": 40,
  "intent_visible": true,
  "pattern": [{ "op": "damage", "value": 10 }],
  "pattern_mode": "cycle",
  "groups": [{ "id": "group_under_pressure_solo", "with": [] }]
}
```

- `intent_visible`은 항상 `true`다.
- `role`: `pressure`, `attrition`, `applier`, `bulwark`
- `pattern_mode`: `cycle`, `conditional`
- 지하 편성: HP 40~90, 의도 피해 8~14, 적 1~2체
- 지상 편성: HP 90~170, 의도 피해 14~22, 적 2~3체
- 보스 HP: 지하 130, 지상 190. 보스에는 `groups`를 만들지 않는다.

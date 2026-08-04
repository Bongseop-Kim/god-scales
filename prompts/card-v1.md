# card-v1 — 단일 신 카드 생성

`prompt_version: card-v1.3`

## 파라미터

`data/gods.json`에서 대상 신을 읽어 아래 자리를 채운다. 신마다 프롬프트를 복사하지 않는다.

| 자리 | 출처 |
| --- | --- |
| `{god}` | `gods[].id` |
| `{god_name}` | `gods[].name` |
| `{tokens}` | `gods[].tokens` |
| `{god_ops}` | `gods[].ops` (비면 공통 연산자만) |

{god_name} 카드 20장을 JSON 배열로 생성하라. 목표 풀 12장의 1.5~2배를 과잉 생성한다.

- 아래 JSON 형식 외의 텍스트를 출력하지 마라.
- `patron`은 `{god}`, 토큰은 `{tokens}`, 귀속 연산자는 `{god_ops}`만 사용한다. **다른 신의 토큰·연산자를 쓰면 `token_scope`로 반송된다.**
- 공통 연산자는 `damage`, `block`, `draw`, `energy`, `heal`, `self_damage`, `apply_token`, `favor_shift`다.
- `chain`은 제우스 귀속이며 `target: enemy`에서만 쓴다. `{god_ops}`에 없으면 쓰지 않는다.
- `target`은 `self`, `enemy`, `all_enemies` 중 하나. `cost`는 0~3.
- 태그는 `attack`, `defend`, `utility`, `multi`, `token`, `favor`, `exhaust`만 사용한다.
- 조건식은 `favor(<god>) >= N`, `has_token(target, <token>) >= N`, `turn > N`, `hp_pct(self) < N`, `deck_count(<tag>) >= N`, `enemy_count() >= N` 형태만 쓴다.
- 카드 이름과 효과문은 신의 성향을 따른다.

## 기대값

코스트당 기대값이 **4.0~8.0**을 벗어나면 `value_outlier`로 반송된다. `tools/value.ts`와 같은 식으로 미리 계산하라.

```
EV = Σ(효과 가중치 × 조건계수 × 대상수) / max(cost, 0.5)
```

- 가중치: `damage` ×1, `block` ×0.8, `draw` ×2.5, `energy` ×3, `heal` ×0.7, `self_damage` ×-1.2, `favor_shift` 0, `chain` = value ×(적수-1)
- `apply_token` 가중치 = 스택 × 토큰값 — shock 1, soaked 0.8, bulwark 2.5, bleed 1.5, frenzy 1.5, mark 2, crit 3, displace 6, deflect 10
- 조건계수: `when`이 있으면 0.5
- 대상수: `target: all_enemies`의 `damage`·`apply_token`은 ×2
- `exhaust` 태그는 최종값 ×0.6
- 적수 기본 2

**토큰이 싼 신(soaked 0.8)은 토큰만으로 카드를 채우면 미달한다. 비싼 토큰(deflect 10, displace 6)은 스택 1로 두고 cost 2~3에 얹는다 — 적의 한 턴을 지우는 값이다.**

**`target: self` 카드는 자기 토큰(bulwark·deflect·crit·frenzy)만 붙일 수 있다.** shock·soaked·mark·bleed·displace를 self에 붙이면 그 디버프가 플레이어에게 걸린다 — `token_scope`로 반송된다.

## 중복

효과 시퀀스를 `op:floor(값/3)`으로 접은 지문이 같으면 `duplicate`로 반송된다. 값을 3 단위로 벌리거나 효과 순서를 바꿔 지문을 분리한다. 단일 `damage 6~8` 카드는 기준 카드와 충돌한다.

```json
[
  {
    "id": "card_{god}_01",
    "name": "카드 이름",
    "patron": "{god}",
    "cost": 1,
    "target": "enemy",
    "effects": [
      { "op": "damage", "value": 4 },
      { "op": "apply_token", "token": "{tokens}[0]", "stacks": 1 }
    ],
    "tags": ["attack", "token"]
  }
]
```

재생성 입력에는 게이트가 출력한 `id`와 반송 키를 붙인다. 같은 형식과 어휘를 유지하며 반송된 수만큼 새 `id`로 다시 생성한다.

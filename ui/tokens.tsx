import type { CSSProperties } from "react";
import { harmfulTokens } from "../core/rules.ts";
import type { TokenName, Tokens } from "../core/state.ts";

/**
 * 지속은 셋뿐이고 근거는 코드다 — `shock`은 `core/combat.ts`의 `endTurn` 맨 끝에서 지워지고,
 * `mark`·`thorns`는 `consumeToken`을 아예 타지 않는다(`core/state.ts:9`의 주석과 같은 사실).
 * 나머지는 한 번 쓰면 스택이 하나 빠진다
 */
type Duration = "turn" | "consume" | "combat";
const durationText: Record<Duration, string> = { turn: "이번 턴", consume: "1회 소모", combat: "전투 내내" };

/**
 * 색은 신이 아니라 **진영**이다(DD2: 노랑=이로움, 파랑=해로움) — 전투 중에 급한 정보는 출처가 아니라
 * 이로운지 해로운지다. 진영은 `harmfulTokens`에서 읽으므로 목록이 늘지 않고, 신 색은 아이콘에 남는다.
 * `text`는 툴팁 한 줄이고 값은 `core/rules.ts`의 계산과 같은 눈금이어야 한다
 */
const tokenStyle: Record<TokenName, { label: string; name: string; icon: string; color: string; duration: Duration; text: string }> = {
  shock: { label: "감", name: "감전", icon: "ϟ", color: "var(--zeus)", duration: "turn", text: "이 대상이 받는 피해 +스택" },
  displace: { label: "지", name: "밀려남", icon: "◴", color: "var(--poseidon)", duration: "consume", text: "다음 행동을 건너뛴다" },
  soaked: { label: "침", name: "침수", icon: "◉", color: "var(--poseidon)", duration: "consume", text: "다음 공격 피해 −1, 광란과 상쇄" },
  bulwark: { label: "벽", name: "방벽", icon: "⬟", color: "var(--athena)", duration: "consume", text: "방어 뒤 스택만큼 피해를 흡수" },
  deflect: { label: "반", name: "반사", icon: "◇", color: "var(--athena)", duration: "consume", text: "다음 공격을 통째로 되돌린다" },
  thorns: { label: "가", name: "가시", icon: "✧", color: "var(--athena)", duration: "combat", text: "맞을 때마다 스택만큼 반격" },
  bleed: { label: "혈", name: "출혈", icon: "◆", color: "var(--ares)", duration: "consume", text: "턴 끝에 스택만큼 피해" },
  frenzy: { label: "광", name: "광란", icon: "✦", color: "var(--ares)", duration: "consume", text: "다음 공격 피해 +2" },
  mark: { label: "표", name: "표식", icon: "⌖", color: "var(--artemis)", duration: "combat", text: "받는 피해 1.5배" },
  crit: { label: "치", name: "치명", icon: "◎", color: "var(--artemis)", duration: "consume", text: "다음 공격 피해 2배" },
};

export const tokenName = (token: TokenName) => tokenStyle[token].name;

/**
 * 배지 하나를 읽는 문장. 배지마다 읽히면 적 하나가 문장 여섯이 되므로 컨테이너가 이것을 모아 한 번
 * 읽는다 — 적 버튼은 `aria-label`에, 플레이어 줄은 `role="img"`에 싣는다
 */
export const tokenSummary = (tokens: Tokens): string => (Object.entries(tokens) as [TokenName, number][])
  .filter(([, stacks]) => stacks > 0)
  .map(([token, stacks]) => `${tokenName(token)} ${stacks}`)
  .join(" ");

function TokenBadge({ token, stacks = 1 }: { token: TokenName; stacks?: number }) {
  const style = tokenStyle[token];
  const harmful = harmfulTokens.has(token);
  return (
    <span
      // 진영을 색에만 실으면 색각 이상에서 사라진다 — 해로움은 채움, 이로움은 외곽이다
      className={`token-badge ${harmful ? "harmful" : "boon"} ${style.duration}`}
      style={{ "--token-color": style.color } as CSSProperties}
      title={`${style.name} — ${style.text} · ${durationText[style.duration]}`}
    >
      <i>{style.icon}</i>
      <b>{style.label}</b>
      <small>{stacks}</small>
    </span>
  );
}

/** 배우 위 한 줄. 넷을 넘으면 접어서 「+N」으로 — 적 3인이면 배지가 스무 개까지 갈 수 있다(DD2도 접는다) */
export function TokenRow({ tokens, limit = 4 }: { tokens: Tokens; limit?: number }) {
  const held = (Object.entries(tokens) as [TokenName, number][]).filter(([, stacks]) => stacks > 0);
  if (!held.length) return null;
  const shown = held.length > limit ? held.slice(0, limit) : held;
  return (
    <span className="actor-tokens" role="img" aria-label={tokenSummary(tokens)}>
      {shown.map(([token, stacks]) => <TokenBadge key={token} token={token} stacks={stacks} />)}
      {held.length > shown.length && <em>+{held.length - shown.length}</em>}
    </span>
  );
}

export function TokenLegend() {
  return (Object.keys(tokenStyle) as TokenName[]).map((token) => <TokenBadge key={token} token={token} />);
}

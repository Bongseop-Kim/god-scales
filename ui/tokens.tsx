import type { CSSProperties } from "react";
import type { TokenName, Tokens } from "../core/state.ts";

const tokenStyle: Record<TokenName, { label: string; name: string; icon: string; color: string }> = {
  shock: { label: "감", name: "감전", icon: "ϟ", color: "var(--zeus)" },
  displace: { label: "지", name: "밀려남", icon: "◴", color: "var(--poseidon)" },
  soaked: { label: "침", name: "침수", icon: "◉", color: "var(--poseidon)" },
  bulwark: { label: "벽", name: "방벽", icon: "⬟", color: "var(--athena)" },
  deflect: { label: "반", name: "반사", icon: "◇", color: "var(--athena)" },
  thorns: { label: "가", name: "가시", icon: "✧", color: "var(--athena)" },
  bleed: { label: "혈", name: "출혈", icon: "◆", color: "var(--ares)" },
  frenzy: { label: "광", name: "광란", icon: "✦", color: "var(--ares)" },
  mark: { label: "표", name: "표식", icon: "⌖", color: "var(--artemis)" },
  crit: { label: "치", name: "치명", icon: "◎", color: "var(--artemis)" },
};

export const tokenName = (token: TokenName) => tokenStyle[token].name;

function TokenBadge({ token, stacks = 1 }: { token: TokenName; stacks?: number }) {
  const style = tokenStyle[token];
  return (
    <span
      className="token-badge"
      style={{ "--token-color": style.color } as CSSProperties}
      title={token}
    >
      <i>{style.icon}</i>
      <b>{style.label}</b>
      <small>{stacks}</small>
    </span>
  );
}

export function TokenRow({ tokens }: { tokens: Tokens }) {
  return (Object.entries(tokens) as [TokenName, number][])
    .filter(([, stacks]) => stacks > 0)
    .map(([token, stacks]) => <TokenBadge key={token} token={token} stacks={stacks} />);
}

export function TokenLegend() {
  return (Object.keys(tokenStyle) as TokenName[]).map((token) => <TokenBadge key={token} token={token} />);
}

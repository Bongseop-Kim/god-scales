import type { CSSProperties } from "react";
import type { TokenName } from "../core/state.ts";

const tokenStyle: Record<TokenName, { label: string; icon: string; color: string }> = {
  shock: { label: "감", icon: "ϟ", color: "var(--zeus)" },
  displace: { label: "지", icon: "◴", color: "var(--poseidon)" },
  soaked: { label: "침", icon: "◉", color: "var(--poseidon)" },
  bulwark: { label: "벽", icon: "⬟", color: "var(--athena)" },
  deflect: { label: "반", icon: "◇", color: "var(--athena)" },
  bleed: { label: "혈", icon: "◆", color: "var(--ares)" },
  frenzy: { label: "광", icon: "✦", color: "var(--ares)" },
  mark: { label: "표", icon: "⌖", color: "var(--artemis)" },
  crit: { label: "치", icon: "◎", color: "var(--artemis)" },
};

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

export function TokenLegend() {
  return (Object.keys(tokenStyle) as TokenName[]).map((token) => <TokenBadge key={token} token={token} />);
}

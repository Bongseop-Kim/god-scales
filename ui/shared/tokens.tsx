import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { harmfulTokens } from "../core/rules.ts";
import type { TokenName, Tokens } from "../core/state.ts";
import { Icon } from "./icon.tsx";

/**
 * 지속은 셋뿐이고 근거는 코드다 — `shock`은 `core/combat.ts`의 `endTurn` 맨 끝에서 지워지고,
 * `mark`·`thorns`는 `consumeToken`을 아예 타지 않는다(`core/state.ts:9`의 주석과 같은 사실).
 * 나머지는 한 번 쓰면 스택이 하나 빠진다. `drain`·`fog`만 「다음 턴」이다 — 적 턴에 붙어
 * `startTurn`이 지우므로 붙은 자리에서는 아직 아무 일도 안 했다
 */
type Duration = "turn" | "next" | "consume" | "combat";
const durationText: Record<Duration, string> = { turn: "이번 턴", next: "다음 턴", consume: "1회 소모", combat: "전투 내내" };

/**
 * 색은 신이 아니라 **진영**이다(DD2: 노랑=이로움, 파랑=해로움) — 전투 중에 급한 정보는 출처가 아니라
 * 이로운지 해로운지다. 진영은 `harmfulTokens`에서 읽으므로 목록이 늘지 않고, 신 색은 아이콘에 남는다.
 * `text`는 툴팁 한 줄이고 값은 `core/rules.ts`의 계산과 같은 눈금이어야 한다
 */
const tokenStyle: Record<TokenName, { name: string; color: string; duration: Duration; text: string }> = {
  shock: { name: "감전", color: "var(--zeus)", duration: "turn", text: "이 대상이 받는 피해 +스택" },
  displace: { name: "밀려남", color: "var(--poseidon)", duration: "consume", text: "다음 행동을 건너뛰고 뒤로 한 칸 밀린다" },
  soaked: { name: "침수", color: "var(--poseidon)", duration: "consume", text: "다음 공격 피해 −1, 광란과 상쇄" },
  bulwark: { name: "방벽", color: "var(--athena)", duration: "consume", text: "방어 뒤 스택만큼 피해를 흡수" },
  deflect: { name: "반사", color: "var(--athena)", duration: "consume", text: "다음 공격을 통째로 되돌린다" },
  thorns: { name: "가시", color: "var(--athena)", duration: "combat", text: "맞을 때마다 스택만큼 반격" },
  // 제우스·포세이돈이 나눠 든다 — 색은 앞선 신 쪽이다. 소모되지 않는 유일한 공격 버프다
  might: { name: "위력", color: "var(--zeus)", duration: "combat", text: "주는 피해 +스택" },
  bleed: { name: "출혈", color: "var(--ares)", duration: "consume", text: "턴 끝에 스택만큼 피해" },
  frenzy: { name: "광란", color: "var(--ares)", duration: "consume", text: "다음 공격 피해 +2" },
  mark: { name: "표식", color: "var(--artemis)", duration: "combat", text: "받는 피해 1.5배" },
  crit: { name: "치명", color: "var(--artemis)", duration: "consume", text: "다음 공격 피해 2배" },
  // 적만 붙인다 — 신 색이 없어 해로움 기본색으로 선다. `startTurn`이 다음 턴 시작에 통째로 지운다
  drain: { name: "고갈", color: "var(--bane)", duration: "next", text: "다음 턴 에너지 −스택" },
  fog: { name: "안개", color: "var(--bane)", duration: "next", text: "다음 턴 뽑기 −스택" },
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

/** 붙는 순간 160ms · 스택이 오르는 순간 140ms. 배지는 한 화면에 13개까지라 `scale`·`opacity`만 쓴다 */
const appear = { duration: 0.16, ease: [0.23, 1, 0.32, 1] } as const;
const bump = { duration: 0.14, ease: [0.23, 1, 0.32, 1] } as const;

function TokenBadge({ token, stacks = 1, still }: { token: TokenName; stacks?: number; still?: boolean }) {
  const style = tokenStyle[token];
  const harmful = harmfulTokens.has(token);
  return (
    <m.span
      /**
       * **붙는 순간이 안 보이던 자리다**([R-26](../reviews/26-hud.md)이 「내게 무엇이 붙었나」를 위해
       * 만든 줄인데 소리 없이 나타났다). 20px 원 안의 글자가 1에서 2로 바뀌는 것도 못 봤으므로
       * 스택은 `key`로 다시 마운트시켜 짧게 튄다 — `DamagePop`이 `hitSeq`를 key로 쓰는 것과 같은 수법이다
       */
      initial={still ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={still ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      transition={still ? { duration: 0 } : appear}
      // 진영을 색에만 실으면 색각 이상에서 사라진다 — 해로움은 채움, 이로움은 외곽이다
      className={`token-badge ${harmful ? "harmful" : "boon"} ${style.duration}`}
      style={{ "--token-color": style.color } as CSSProperties}
      title={`${style.name} — ${style.text} · ${durationText[style.duration]}`}
    >
      {/**
        * **한 글자 한글이 여기 있었다.** 계획은 그것을 아이콘 폴백으로 남기라고 했지만, 시트가 `?raw`로
        * JS 번들에 실리므로 「아이콘이 안 뜰 때」가 곧 「앱이 안 뜰 때」다 — 폴백이 지킬 실패가 없다.
        * 흰 글자를 위에 겹치면 20px 아이콘의 가운데를 덮어 형태가 안 읽힌다(R-33). 이름은 `title`과
        * `tokenSummary`의 `aria-label`이 든다
        */}
      <Icon name={token} />
      {still
        ? <small>{stacks}</small>
        : <m.small key={stacks} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={bump}>{stacks}</m.small>}
    </m.span>
  );
}

/** 배우 위 한 줄. 넷을 넘으면 접어서 「+N」으로 — 적 3인이면 배지가 스무 개까지 갈 수 있다(DD2도 접는다) */
export function TokenRow({ tokens, limit = 4 }: { tokens: Tokens; limit?: number }) {
  const reducedMotion = useReducedMotion();
  const held = (Object.entries(tokens) as [TokenName, number][]).filter(([, stacks]) => stacks > 0);
  const shown = held.length > limit ? held.slice(0, limit) : held;
  // 빈 줄에도 컨테이너가 남아야 한다 — `null`을 돌려주면 `AnimatePresence`가 통째로 사라져 퇴장이 없다.
  // 다만 이름 없는 `role="img"`는 스크린 리더에서 정체 불명의 그림 한 장이 된다 — 빌 때는 감춘다
  return (
    <span className="actor-tokens" role="img" aria-label={tokenSummary(tokens)} aria-hidden={held.length ? undefined : true}>
      <AnimatePresence initial={false}>
        {shown.map(([token, stacks]) => <TokenBadge key={token} token={token} stacks={stacks} still={!!reducedMotion} />)}
      </AnimatePresence>
      {held.length > shown.length && <em>+{held.length - shown.length}</em>}
    </span>
  );
}

export function TokenLegend() {
  const reducedMotion = useReducedMotion();
  return (Object.keys(tokenStyle) as TokenName[]).map((token) => <TokenBadge key={token} token={token} still={!!reducedMotion} />);
}

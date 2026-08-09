import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import type { EnemyAction } from "../../core/combat.ts";
import { favorBoundaries } from "../../core/favor.ts";
import { graceMilestones } from "../../core/grace.ts";
import { harmfulTokens } from "../../core/rules.ts";
import type { PassiveName, TokenName, Tokens } from "../../core/state.ts";
import { Icon, type IconName } from "./icon.tsx";

/**
 * 전용 픽셀 아이콘 13종(P-57). 흰색 + 알파 원본을 `mask`로 쓰고 색은 `--token-color`가 칠한다 —
 * `<img>`는 틴트가 안 되므로 카드 프레임(`.game-card::before`)과 같은 수법이다. 13장이 번들에
 * 실리므로 「안 뜰 때가 곧 앱이 안 뜰 때」 — 폴백을 만들지 않는다(R-33과 같은 판단)
 */
const tokenArt = import.meta.glob<string>("../../art/tokens/*.webp", { eager: true, query: "?url", import: "default" });

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
  displace: { name: "밀려남", color: "var(--poseidon)", duration: "consume", text: "다음 행동을 건너뛰고 뒤로 한 칸 밀림" },
  soaked: { name: "침수", color: "var(--poseidon)", duration: "consume", text: "다음 공격 피해 −1, 광란과 상쇄" },
  bulwark: { name: "방벽", color: "var(--athena)", duration: "consume", text: "방어 뒤 스택만큼 피해를 흡수" },
  deflect: { name: "반사", color: "var(--athena)", duration: "consume", text: "다음 공격을 막고 그대로 되돌림" },
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

/** 적 발밑의 보라색 능력 칩과 사전이 함께 읽는다 — 이름·효과가 두 화면에서 갈리지 않게 한 표만 둔다 */
const passiveStyle: Record<PassiveName, { name: string; text: string }> = {
  guard: { name: "보호", text: "스택마다 사거리 안 아군의 단일 대상 피해를 대신 받음" },
  shell: { name: "경화", text: "한 턴에 잃는 체력을 스택 이하로 제한" },
  ward: { name: "결계", text: "해로운 토큰을 스택만큼 막음" },
  curl: { name: "웅크림", text: "처음 체력을 잃으면 방어 +스택" },
  angry: { name: "분노", text: "체력을 잃을 때마다 광란 +스택" },
  rally: { name: "규합", text: "다른 적이 쓰러지면 광란 +스택" },
  ramp: { name: "고조", text: "행동할 때마다 광란 +스택" },
  spite: { name: "앙심", text: "공격이 아닌 카드를 내면 광란 +스택" },
};

export const tokenName = (token: TokenName) => tokenStyle[token].name;
export const passiveName = (passive: PassiveName) => passiveStyle[passive].name;
export const passiveTitle = (passive: PassiveName) => `${passiveStyle[passive].name} — ${passiveStyle[passive].text}`;

/** 적 머리 위 의도와 사전이 같은 아이콘 변환을 쓴다 */
export const intentBits = (action?: EnemyAction): [IconName, number | undefined][] => {
  const bits: [IconName, number | undefined][] = [];
  if (action?.damage) bits.push(["damage", action.damage]);
  if (action?.block) bits.push(["block", action.block]);
  if (action?.heal) bits.push(["heal", action.heal]);
  if (action?.token) bits.push([action.token, action.stacks ?? 1]);
  if (action?.favor) bits.push(["favor", action.favor]);
  return bits.length ? bits : [["idle", undefined]];
};

const intentStyle: { name: string; text: string; action?: EnemyAction }[] = [
  { name: "공격", text: "플레이어에게 피해", action: { damage: 1 } },
  { name: "방어", text: "자신이나 아군에게 방어", action: { block: 1 } },
  { name: "회복", text: "자신이나 아군의 체력 회복", action: { heal: 1 } },
  { name: "토큰", text: "플레이어나 자신·아군에게 토큰", action: { token: "shock" } },
  { name: "호의", text: "두 후원 신의 호의 감소", action: { favor: -1 } },
  { name: "대기", text: "이번 행동을 건너뜀" },
];

/**
 * 배지 하나를 읽는 문장. 배지마다 읽히면 적 하나가 문장 여섯이 되므로 컨테이너가 이것을 모아 한 번
 * 읽는다 — 적 버튼은 `aria-label`에, 플레이어 줄은 `role="img"`에 싣는다
 */
export const tokenSummary = (tokens: Tokens): string => (Object.entries(tokens) as [TokenName, number][])
  .filter(([, stacks]) => stacks > 0)
  .map(([token, stacks]) => `${tokenName(token)} ${stacks}`)
  .join(" ");

/** 붙는 순간 240ms · 스택이 오르는 순간 200ms. 배지는 한 화면에 13개까지라 `scale`·`opacity`만 쓴다 */
const appear = { duration: 0.24, ease: [0.23, 1, 0.32, 1] } as const;
const bump = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;

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
      // 진영을 색에만 실으면 색각 이상에서 사라진다 — 해로움은 채움, 이로움은 빈 바탕이다
      className={`token-badge ${harmful ? "harmful" : "boon"} ${style.duration}`}
      style={{ "--token-color": style.color } as CSSProperties}
      title={`${style.name} — ${style.text} · ${durationText[style.duration]}`}
    >
      {/**
        * 전용 아이콘(P-57) — `icons.svg`의 범용 글리프가 카드 효과 줄·의도로 물러나고 배지는
        * 토큰마다 제 그림을 든다. 이름은 `title`과 `tokenSummary`의 `aria-label`이 든다
        */}
      <i className="token-icon" style={{ "--token-icon": `url("${tokenArt[`../../art/tokens/${token}.webp`]}")` } as CSSProperties} />
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

/**
 * 게임 사전의 토큰 목록(P-53) — 13종을 한눈에. **데이터는 `tokenStyle` 하나에서** 만든다: 사전용 사본을 만들면
 * 같은 사실에 두 경로다. 진영(빈 바탕/채움)·지속 띠는 배지가 이미 들고 있으므로 여기서 다시 말하지 않는다.
 * 셋째 목록(카드 기호, P-61)은 `card.tsx`의 것이라 **자식으로 받는다** — 여기서 import하면 순환이다
 */
export function TokenDictionary({ children }: { children?: ReactNode }) {
  return (
    <div className="token-dictionaries">
      <ul className="token-dict">
        {(Object.entries(tokenStyle) as [TokenName, (typeof tokenStyle)[TokenName]][]).map(([token, style]) => (
          <li key={token}>
            <TokenBadge token={token} still />
            <b>{style.name}</b>
            <em>{durationText[style.duration]}</em>
            <span>{style.text}</span>
          </li>
        ))}
      </ul>
      <h3>적 능력</h3>
      <ul className="token-dict">
        {(Object.entries(passiveStyle) as [PassiveName, (typeof passiveStyle)[PassiveName]][]).map(([passive, style]) => (
          <li key={passive}>
            <i className="passive-icon"><Icon name={passive} /></i>
            <b>{style.name}</b>
            <em>패시브</em>
            <span>{style.text}</span>
          </li>
        ))}
      </ul>
      <h3>전투 상태</h3>
      {/* 순서는 좌상단 칩 줄(`board-chips`) 그대로 — 화면에서 본 차례로 찾게 한다 */}
      <ul className="token-dict">
        <li>
          <i className="passive-icon"><Icon name="omen" /></i>
          <b>과업</b>
          <em>맵 도전</em>
          <span>과업 노드에서 받은 신의 조건 · 이번 전투에서 달성하면 호의와 카드 보상 · 칩을 누르면 저널</span>
        </li>
        <li>
          <i className="passive-icon"><Icon name="favor" /></i>
          <b>개입</b>
          <em>자동 행동</em>
          <span>두 후원 신이 2턴째부터 3턴마다 호의 단계대로 행동 · 칩의 숫자는 다음 개입까지 남은 턴</span>
        </li>
        <li>
          <i className="passive-icon">−1</i>
          <b>훼방</b>
          <em>호의 단계</em>
          <span>분노한 신이 다른 후원 신 카드의 피해·방어·연쇄를 1 낮춤 · 분노한 신의 호의가 평온으로 돌아오면 해제</span>
        </li>
        <li>
          <i className="passive-icon">P</i>
          <b>파워</b>
          <em>지속 효과</em>
          <span>손을 떠난 뒤 전투 내내 지정된 때마다 일하는 카드 · 좌상단 칩에 카드 이름으로 표시 · 호버로 발동 시점과 효과 확인</span>
        </li>
      </ul>
      {children}
      <h3>적 의도</h3>
      <ul className="token-dict">
        {intentStyle.map(({ name, text, action }) => (
          <li key={name}>
            <i className="passive-icon"><Icon name={intentBits(action)[0][0]} /></i>
            <b>{name}</b>
            <em>다음 행동</em>
            <span>{text}</span>
          </li>
        ))}
        <li>
          <i className="passive-icon"><Icon name="omen" /></i>
          <b>의도 감춤</b>
          <em>알 수 없음</em>
          <span>다음 행동을 공개하지 않음</span>
        </li>
      </ul>
      <h3>신과 호의</h3>
      <ul className="token-dict">
        <li><i className="passive-icon"><Icon name="favor" /></i><b>헌신</b><em>{favorBoundaries.devotion}~100</em><span>신이 조우 시작과 개입 때 가장 강하게 돕습니다.</span></li>
        <li><i className="passive-icon"><Icon name="favor" /></i><b>평온</b><em>{favorBoundaries.calm}~{favorBoundaries.devotion - 1}</em><span>신이 조우 시작과 개입 때 돕습니다.</span></li>
        <li><i className="passive-icon"><Icon name="favor" /></i><b>분노</b><em>{favorBoundaries.anger}~{favorBoundaries.calm - 1}</em><span>신이 다른 후원 신 카드의 피해·방어·연쇄를 1 낮춥니다.</span></li>
        <li><i className="passive-icon"><Icon name="favor" /></i><b>진노</b><em>0~{favorBoundaries.anger - 1}</em><span>신이 적으로 합류하고 플레이어를 방해합니다.</span></li>
        <li><i className="passive-icon"><Icon name="seal" /></i><b>은총</b><em>은혜 {graceMilestones.join("·")}격</em><span>은총 수가 다음 은혜의 격을 정하며, 두 후원 신의 인장을 한 카드에 모으면 융합합니다.</span></li>
      </ul>
    </div>
  );
}

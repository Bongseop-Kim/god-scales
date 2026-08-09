import { useState } from "react";
import { MAX_SLOTS } from "../../core/combat.ts";
import { attackPreview, cardLevel, upgraded, type Card } from "../../core/rules.ts";
import type { Tokens } from "../../core/state.ts";
import { fullReach, reachSlots } from "../../core/targeting.ts";
import cardDataJson from "../../data/cards.json" with { type: "json" };
import type { CardView } from "../../sim/engine.ts";
import { cardTier } from "../../tools/value.ts";
import { cardArtCandidates, cardGod, cardTag, particleStrip, type CardArtSource } from "./art-keys.ts";
import { Icon, type IconName } from "./icon.tsx";
import { playSound } from "./sfx.ts";
import { tokenName } from "./tokens.tsx";

const cardArt = import.meta.glob<string>("../../art/cards/*.webp", { eager: true, query: "?url", import: "default" });
/**
 * 그림·프레임색·파티클·이름·파워는 **값이 아니라 종류**라 `data/cards.json`에서 직접 읽는다 — 엔진의
 * `CardView`는 값만 싣는다(`sim/engine.ts:130`). 적 이름을 `data/enemies.json`에서 읽는 자리와 같다.
 * 179개 id와 그림 179장의 이름 규칙은 `ui/art-keys.ts`에 있고 `tools/art.ts`가 같은 것을 쓴다
 */
const cardFace = new Map((cardDataJson as unknown as (Card & CardArtSource)[]).map((card) => [card.id, {
  art: cardArtCandidates(card).map((key) => cardArt[`../../art/cards/${key}.webp`]).find(Boolean),
  god: cardGod(card),
  tag: cardTag(card),
  name: card.name,
  // 파워의 정본은 `power` 태그다(`core/rules.ts:292`) — `trigger`는 그 태그가 붙은 카드만 갖는다
  power: (card.tags ?? []).includes("power"),
  // 등급 규칙은 게이트와 같은 함수다 — 두 벌이면 「게이트는 상급인데 화면은 아니다」가 생긴다
  tier: cardTier(card),
  /**
   * 카드 원문 그대로. **강화 전 값의 출처는 이 파일이다** — 그것이 base 카드의 정의 자체라
   * 규칙을 다시 계산하는 것이 아니고 두 번째 진실도 아니다. 쉼터 미리보기의 `upgraded`도 여기서 읽는다
   */
  base: card,
}]));
/**
 * 티어 이름. **tier1에는 배지가 없다** — 149장 중 124장이 그것이라 붙이면 배지가 아니라 배경이 된다.
 * 색이 아니라 글자인 이유는 R-26의 채널 규칙과 같다: 색만으로는 흑백에서 등급이 사라진다
 */
const tierNames: Record<number, string> = { 2: "상급", 3: "융합" };

/** 카드를 낼 때 튀는 파티클. 모르는 신은 그 갈래의 첫 그림으로 떨어진다 */
export const cardParticleOf = (cardId: string): string | undefined => {
  const face = cardFace.get(cardLevel(cardId).base);
  const strip = face?.tag && particleStrip[face.tag];
  return strip && (strip[face?.god ?? ""] ?? Object.values(strip)[0]);
};
const opLabels: Record<string, string> = {
  damage: "피해",
  block: "방어",
  draw: "뽑기",
  energy: "에너지",
  heal: "회복",
  self_damage: "자해",
  favor_shift: "호의",
  chain: "연쇄",
};
/**
 * op → 아이콘. **아이콘을 새로 그리지 않는다**([R-33](../reviews/33-icons.md)의 「그린 것 0」) — 시트
 * 28개에 있는 것은 이 셋과 토큰 10종뿐이다. `apply_token`은 **그 토큰 자신의 아이콘**을 쓴다: 「감전」
 * 카드와 적 머리 위 배지가 같은 글리프가 되는 자리다. 나머지 다섯 op는 짧은 한글 그대로 나간다
 */
const opIcons: Record<string, IconName> = { damage: "damage", block: "block", heal: "heal" };
/**
 * 조건 DSL → 사람이 읽는 한 줄. 조건부 효과는 화면에서 흐려지므로(`.card-fx .cond`) **왜 흐린지**가
 * 어딘가에 있어야 한다 — 그 자리가 `title`과 `aria-label`이다. 배포된 카드 아홉 장에 다섯 줄뿐이고
 * 어휘는 `tools/validate.ts`의 `conditionPatterns`가 잠근다. 모르는 조건은 **원문이 그대로 나간다**:
 * 「조건」으로 뭉개면 새 조건 하나가 화면에서 조용히 뜻을 잃는다
 */
const conditionText: Record<string, string> = {
  "favor(patron) >= 70": "후원 신 호의 70 이상",
  "has_token(target, mark) >= 1": `${tokenName("mark")}이 붙은 대상`,
  "hp_pct(self) < 50": "내 체력 절반 미만",
  "slot(target) < 2": "앞 두 칸의 대상",
  "slot(target) >= 2": "뒤 두 칸의 대상",
  "cards_played_in_turn >= 3": "이번 턴 세 장째부터",
  "attacks_in_turn >= 3": "이번 턴 공격 세 번째부터",
  "energy_spent_in_turn >= 3": "이번 턴 에너지 3 이상 썼을 때",
  "hand_count < 2": "손패 한 장 이하",
  "hand_count < 3": "손패 두 장 이하",
  "hp_pct(target) < 30": "대상 체력 30% 미만",
  "hp_pct(target) < 40": "대상 체력 40% 미만",
  "block(self) >= 6": "내 방어 6 이상",
  "block(self) >= 8": "내 방어 8 이상",
  "block(self) >= 10": "내 방어 10 이상",
  "block(self) >= 12": "내 방어 12 이상",
};
export const conditionLabel = (when: string): string => conditionText[when] ?? when;

type CardEffect = CardView["effects"][number];
/** 효과 한 조각이 세우는 숫자. 토큰만 스택이고 나머지는 값이다 */
const effectNumber = ({ op, value, stacks }: CardEffect): number => (op === "apply_token" ? stacks ?? 1 : value ?? 0);
/**
 * 지금 누르면 나갈 값. 피해·연쇄만 공격자 쪽 토큰을 태운다 — 둘 다 `strike` → `dealDamage`를 지나므로
 * 화면과 엔진이 같은 함수(`attackPreview`)를 부른다. `boost`가 없으면 카드에 적힌 값 그대로다
 */
const shownNumber = (effect: CardEffect, boost?: Tokens): number =>
  boost && (effect.op === "damage" || effect.op === "chain") ? attackPreview(boost, effect.value ?? 0) : effectNumber(effect);

/** 값은 엔진이 준 것을 그대로 읽는다 — UI가 data/cards.json을 따로 읽으면 같은 사실에 두 경로가 생긴다 */
export function effectText({ target, effects }: Pick<CardView, "target" | "effects">, boost?: Tokens): string {
  const text = effects
    .map((effect) =>
      `${effect.op === "apply_token" ? tokenName(effect.token!) : opLabels[effect.op] ?? effect.op} ${shownNumber(effect, boost)}${effect.when ? ` (${conditionLabel(effect.when)})` : ""}`)
    .join(" · ");
  return target === "all_enemies" ? `전체 · ${text}` : text;
}

/**
 * 사거리 아홉 모양의 한글 이름. **이 표는 화면에만 있다** — 규칙은 `reachOk` 정규식 하나이므로 열째
 * 모양을 만들어도 코드가 안 바뀌고, 모르는 마스크는 아래에서 `칸 0·3` 꼴로 떨어진다
 */
const reachNames: Record<string, string> = {
  "0123": "전체", "0": "앞 한 칸", "01": "앞 둘", "012": "앞 셋",
  "12": "가운데 둘", "123": "뒤 셋", "23": "뒤 둘", "3": "뒤 한 칸", "03": "양 끝",
};
/** 네 칸 그림. 아홉 모양은 글자만으로 안 읽힌다 — 어느 칸에 닿는지가 그림이어야 한 눈에 든다 */
export function reachBars(reach = fullReach): string {
  const slots = reachSlots(reach);
  return Array.from({ length: MAX_SLOTS }, (_, slot) => (slots.includes(slot) ? "▮" : "▯")).join("");
}
export const reachText = (reach = fullReach): string =>
  `${reachBars(reach)} ${reachNames[reach] ?? `칸 ${reachSlots(reach).join("·")}`}`;

/**
 * 카드 면 기호의 범례(P-61) — 토큰 사전의 셋째 목록이고 `TokenDictionary`가 자식으로 받는다.
 * 토큰 열셋과 적 능력 여덟은 사전에 있었는데 **카드 면의 기호는 어디에도 설명이 없었다.**
 * 그림은 카드가 쓰는 클래스·함수를 그대로 세운다 — 설명용 사본을 그리면 카드가 바뀔 때 사전만 옛 얼굴이다
 */
export const CardSigns = () => (
  <>
    <h3>카드 기호</h3>
    <ul className="token-dict sign-dict">
      <li><span className="sign"><b className="cost-gem">2</b></span><span>이 카드를 내는 데 드는 에너지</span></li>
      <li><span className="sign"><em className="card-reach">{reachBars("0")}</em></span><span>닿는 칸 — 채운 칸의 적만 대상</span></li>
      <li><span className="sign card-fx"><Icon name="damage" /><Icon name="block" /><Icon name="heal" /></span><span>그 효과의 값</span></li>
      <li><span className="sign card-fx"><em><Icon name="shock" /><b>2</b></em></span><span>붙일 토큰과 스택</span></li>
      <li><span className="sign"><em className="card-kind">파워</em></span><span>손을 떠나 전투 내내 매 턴 발동</span></li>
      <li><span className="sign"><em className="card-kind">전체</em></span><span>사거리 안 모든 적</span></li>
      <li><span className="sign">{Object.values(tierNames).map((name) => <em key={name} className="card-tier">{name}</em>)}</span><span>카드 등급</span></li>
      <li><span className="sign"><em className="card-up">+1</em></span><span>쉼터에서 올린 강화 단계</span></li>
      <li><span className="sign card-fx"><em><Icon name="damage" /><s>6</s><b className="up">11</b></em></span><span>카드에 적힌 값과 지금 나갈 값</span></li>
      <li><span className="sign card-fx"><em className="cond"><Icon name="damage" /><b>6</b></em></span><span>조건이 맞을 때만 붙는 효과</span></li>
    </ul>
  </>
);

/**
 * 스크린 리더가 읽는 카드 한 줄. **화면은 채널 넷으로 갈라 그린다**(젬·배지·효과 줄·캡션) — 숫자만
 * 남으면 「8 2」로 읽히므로 문장은 여기서 한 번 만들어 `aria-label`이 든다.
 * 자기 대상 카드에는 사거리 칸이 없다 — 닿을 적이 없으므로 읽으면 거짓말이다
 */
export const cardCaption = (card: CardView, boost?: Tokens) =>
  `${card.name} · ${card.cost} 에너지 · ${card.target === "self" ? "" : `${reachText(card.reach)} · `}${effectText(card, boost)}`;

/**
 * e2e 드라이버가 읽는 값(`tools/e2e.ts`). 화면 문구를 정규식으로 긁던 자리를 대신한다 — 비용을 젬으로
 * 옮기는 순간 그 정규식은 149장 전부 -1을 돌려주고도 **조용히** 완주한다
 */
const cardDamage = (card: CardView) =>
  card.effects.reduce((sum, { op, value }) => sum + (op === "damage" || op === "chain" ? value ?? 0 : 0), 0);

/** 보상과 카드 제거가 같은 격자를 쓴다. 손패만 부채꼴이라 따로 그린다 — 은혜는 카드가 아니라 `Choice`다 */
export function CardRow({ cards, options, onSelect, upgrade, value = ({ id }) => id }: {
  cards: CardView[];
  options: string[];
  onSelect: (choice: string) => void;
  /** 쉼터의 강화 고르기 하나 — 고를 수 있는 카드가 **강화 후 얼굴로** 선다. 못 고르는 칸은 지금 얼굴이다 */
  upgrade?: boolean;
  /** 카드 id가 아닌 답이 필요하면 이 함수만 바꾼다 */
  value?: (card: CardView, index: number) => string;
}) {
  return (
    <div className="hand">
      {cards.map((card, index) => {
        const pickable = options.includes(value(card, index));
        return (
          <GameCard
            key={`${card.id}-${index}`}
            cardId={card.id}
            card={card}
            upgrade={upgrade && pickable}
            disabled={!pickable}
            onSelect={() => onSelect(value(card, index))}
          />
        );
      })}
    </div>
  );
}

/**
 * 효과 한 조각. 아이콘이 있는 넷은 글리프 + 굵은 숫자, 없는 다섯은 짧은 한글 + 숫자다.
 *
 * **원래 적힌 값과 지금 나갈 값이 다르면 원래 값이 취소선으로 앞에 선다.** 중간 단계는 안 적는다 —
 * 6 → 8 → 11을 다 적으면 140px 카드가 숫자 밭이 되고, 사람이 알아야 하는 것은 「카드에 적힌 값」과
 * 「지금 누르면 나갈 값」 둘이다. 취소선 자체가 흑백에서도 남는 채널이라 **색만으로 말하지 않는다**(R-26)
 */
function Effect({ effect, written, boost }: { effect: CardEffect; written: number; boost?: Tokens }) {
  const { op, token, when } = effect;
  const icon = op === "apply_token" ? token : opIcons[op];
  const shown = shownNumber(effect, boost);
  // `self_damage`만 경고색이다 — 그 줄은 내가 손해 보는 줄이다
  const kind = [op === "self_damage" && "harm", when && "cond"].filter(Boolean).join(" ");
  return (
    <em className={kind || undefined} title={when && conditionLabel(when)}>
      {icon ? <Icon name={icon} /> : opLabels[op] ?? op}
      {shown !== written && <s>{written}</s>}
      <b className={shown === written ? undefined : shown > written ? "up" : "down"}>{shown}</b>
    </em>
  );
}

/**
 * 카드 면은 채널 넷이다: **좌상단 비용 젬 · 우상단 예외 배지 · 효과 줄(카드의 본체) · 이름 캡션.**
 * 관례는 어느 카드 게임을 봐도 같다(Slay the Spire · Hearthstone · MTG) — 비용은 언제나 같은 픽셀에
 * 있고 효과 숫자가 제일 크다. `card`가 없는 자리는 결과 화면의 「낸 카드」뿐이라 이름과 그림만 선다
 */
export function GameCard({ cardId, card, boost, upgrade, disabled, onSelect }: {
  cardId: string;
  card?: CardView;
  /**
   * 플레이어의 지금 토큰. 넘기는 자리는 **전투 화면의 손패·무대 둘뿐이다** — 덱 오버레이·보상·쉼터·
   * 결과는 토큰이 없는 자리라 안 넘긴다. 안 넘기면 강화분만 비교한다
   */
  boost?: Tokens;
  /** 쉼터의 강화 후보. 한 단 더 올린 얼굴로 선다 — 고르기 전과 고른 뒤가 같은 얼굴이다 */
  upgrade?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  // 업그레이드본은 `card_zeus_12+1`이다 — 그림·프레임색·등급은 base의 것이고 `+N`은 배지가 든다
  const { base, level } = cardLevel(cardId);
  const face = cardFace.get(base);
  /**
   * 그릴 카드. 미리보기는 **같은 규칙 함수**(`upgraded`)를 부르므로 재구현이 아니다 —
   * `data-*` 셋은 아래에서 그대로 덱에 있는 카드의 값을 싣는다(e2e 계약)
   */
  const shown: CardView | undefined = upgrade && face ? upgraded(face.base, level + 1) : card;
  const shownLevel = upgrade ? level + 1 : level;
  const source = face?.art;
  const [missing, setMissing] = useState(!source);
  // 예외만 적는다 — 149장 중 20장이다(파워 6 · 전체 14, 데이터상 안 겹친다). 슬롯이 하나뿐이다
  const kind = face?.power ? "파워" : shown?.target === "all_enemies" ? "전체" : undefined;
  const label = shown && cardCaption(shown, boost);
  const body = (
    <>
      <div className={`card-art${missing ? " missing" : ""}`}>
        {source && <img src={source} alt="" loading="lazy" onError={() => setMissing(true)} />}
        <span aria-hidden="true">⚖</span>
      </div>
      {shown && <b className="cost-gem">{shown.cost}</b>}
      {kind && <em className="card-kind">{kind}</em>}
      {shown && (
        <span className="card-fx">
          {/* 사거리는 마스크를 적은 26장에만 선다 — 기본값(네 칸 전부)에 그리면 같은 뜻의 두 번째 표기다 */}
          {shown.reach && <em className="card-reach" title={reachText(shown.reach)}>{reachBars(shown.reach)}</em>}
          {/* 원래 값은 원문에서 읽는다. 은혜는 뒤에 잇고 훼방은 값을 낮춘다(`cardEffects`) — 앞에서부터 인덱스로 맞고 뒤에 남는 것이 은혜다 */}
          {shown.effects.map((effect, index) => (
            <Effect key={index} effect={effect} written={effectNumber(face?.base.effects[index] ?? effect)} boost={boost} />
          ))}
        </span>
      )}
      <small>
        {/* 등급은 이름 앞에 선다 — 보상 3택1에서 한 자리가 다른 계단이라는 것이 **글자로** 보여야 한다 */}
        {face && face.tier > 1 && <em className="card-tier">{tierNames[face.tier]}</em>}
        {/* 등급은 카드가 태어난 계단이고 강화는 이 런에서 키운 것이라 직교한다 — 같은 줄, 다른 슬롯이다 */}
        {shownLevel > 0 && <em className="card-up">+{shownLevel}</em>}
        {/* 이름은 원문이다 — `+N`은 배지가 들었으므로 캡션에서 뗀다(이름 최대 7자 규칙이 여기서 닫힌다) */}
        {face?.name ?? card?.name ?? cardId}
      </small>
    </>
  );

  return onSelect
    ? (
      <button
        className={`game-card${card?.weakened ? " weakened" : ""}`}
        type="button"
        data-card={cardId}
        data-god={face?.god}
        data-cost={card?.cost}
        data-damage={card && cardDamage(card)}
        aria-label={label}
        disabled={disabled}
        onMouseEnter={() => playSound("card-place-4", 0.12)}
        onClick={() => { playSound("card-slide-6", 0.35); onSelect(); }}
      >
        {body}
      </button>
    )
    : <article className={`game-card${card?.weakened ? " weakened" : ""}`} data-card={cardId} data-god={face?.god} aria-label={label}>{body}</article>;
}

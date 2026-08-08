import { Fragment, useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { favorBoundaries, favorStage, interventionEveryTurns } from "../../core/favor.ts";
import type { GodId } from "../../core/rules.ts";
import { deckSize, favorPool, gods, startableCards, type PatronPair } from "../../sim/engine.ts";
import { Backdrop, hero, Prop } from "../shared/backdrop.tsx";
import { CardRow, GameCard } from "../shared/card.tsx";
import { godArt, godName, godStageText, stageName } from "../shared/header.tsx";

/**
 * id → 그 카드의 신과 면. 시작 화면에는 관측이 없으므로 **값은 엔진이 내보낸 `startableCards`에서**
 * 온다 — UI가 `data/cards.json`을 따로 읽으면 같은 사실에 두 경로가 생긴다(`ui/card.tsx`와 같은 규칙)
 */
const cardIndex = new Map(gods.flatMap((god) => startableCards[god].map((card) => [card.id, { god, card }] as const)));

/**
 * 1040px 게임이 브라우저 탭·주소창·북마크바 아래에 앉아 있는 것을 지운다. **상태를 직접 들지 않는다** —
 * F11·Esc·창 전환으로 나가면 내 state와 화면이 어긋난다. 정본은 언제나 `document.fullscreenElement`고
 * `fullscreenchange`는 그래서 `document`에 건다(`element`에 걸면 나가는 순간을 놓친다).
 *
 * `requestFullscreen()`은 **클릭 핸들러 안에서만** 통한다 — 밖에서 부르면 조용히 거부된 Promise만
 * 남는다. 시작 화면에서 자동으로 켜는 것은 불가능하고, 시도해서도 안 된다
 */
export function FullscreenButton({ menu = false }: { menu?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // `type="button"` 필수 — 지금은 `<form className="shell setup">` 바깥이지만 `<button>`의 기본값은 submit이다
  return (
    <button type="button" className={menu ? undefined : "fullscreen"} onClick={() => (on ? document.exitFullscreen() : document.body.requestFullscreen())}>
      {on ? "창 모드" : "전체화면"}
    </button>
  );
}

/**
 * 타이틀 화면. 배경은 setup과 같은 `hero-title.webp`다 — 그 그림이 좌상단을 제목 자리로 비워 두었다.
 * eyebrow(「결정론적 덱빌딩 프로토타입」)는 지웠다 — 이제 사실도 아니다(P-56). 메뉴는 제목 아래
 * 좌측 세로 스택이고 우측 절반은 배경 일러의 자리라 비워 둔다. 시뮬 통계는 시작 화면에서 이사 왔다
 */
export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <>
      <Backdrop src={hero("title")} tone="hero" />
      <div className="shell intro">
        <header>
          <h1>신들의 저울</h1>
        </header>
        <nav className="intro-menu">
          <button type="button" className="primary" onClick={onStart}>게임 시작</button>
          <a href="./stats.html">시뮬 통계</a>
          <FullscreenButton menu />
        </nav>
        {/* 메뉴 옆을 떠도는 도깨비불(P-58 §12) — 배경과 UI 사이, 안 눌린다 */}
        <Prop name="under_wisp" className="intro-wisp w0 floaty" />
        <Prop name="under_wisp" className="intro-wisp w1 floaty" />
      </div>
    </>
  );
}

/**
 * 시작 덱 편집기. **접혀 있는 것이 기본이라** 시작 화면 높이는 그대로다 — 상태는 `<details>`가 든다.
 * 규칙이 뽑은 열 장이 미리 차 있어 손대지 않으면 고정 모드와 같은 런이다: 빈 열 칸에서 시작하면
 * 124장을 훑어야 한다. 슬롯을 누르면 빠지고 목록을 누르면 들어간다.
 *
 * **중복도 상한도 두지 않는다** — 지금 규칙 덱부터가 같은 카드 2·3장이고, 같은 카드 열 장은 나쁜
 * 덱이지 막을 것이 아니다. 열한째는 조합 선택과 같은 꼴로 가장 오래된 것을 밀어낸다: 「먼저 빼세요」를
 * 만들지 않는다. 카드는 `CardRow`/`GameCard` 그대로다 — 보상 화면과 같은 그림이라 새 컴포넌트가 없다
 */
function DeckEditor({ deck, picked, onChange, onRestore }: {
  deck: string[];
  picked: GodId[];
  onChange: (deck: string[]) => void;
  /**
   * 「손대지 않았다」로 되돌린다. **되돌릴 길이 없으면 편집기는 한 방향 문이다** — 조합을 둘에서
   * 하나로 줄이면 슬롯이 비고(규칙 덱을 못 뽑는다) 거기서 한 장을 넣으면 아홉 장이 모자란 채 갇힌다.
   * 규칙 덱을 그대로 채워 넣지 않는 이유는 반출이다: `undefined`라야 이 런이 고정 모드로 남는다
   */
  onRestore: () => void;
}) {
  const [tab, setTab] = useState<GodId>(gods[0]);
  const list = startableCards[tab];
  return (
    <details className="deck-editor">
      <summary>시작 덱 {deck.length} / {deckSize}장 — 손대지 않으면 규칙이 뽑은 열 장입니다</summary>
      {/*
        §3의 저울은 **이미 코드에 있다**(`core/favor.ts`) — 지금까지 어디에도 안 적혀 있었을 뿐이다.
        조합 밖 신의 카드는 그 신의 호의만 올리고, 은혜·개입·합성은 전부 `patrons`만 읽는다
      */}
      <p className="hint">
        조합 밖 신의 카드도 넣을 수 있습니다. 다만 그 신의 호의는 아무것도 움직이지 않고, 조우마다
        후원 신 호의가 −3씩(그 조우에 한 장도 안 쓴 신은 −2 더) 빠집니다 — 은혜와 융합이 그만큼 멀어집니다.
      </p>
      <div className="deck-slots">
        {deck.map((id, index) => {
          const held = cardIndex.get(id)!;
          const alien = !picked.includes(held.god);
          return (
            <span className={alien ? "slot alien" : "slot"} key={`${id}-${index}`}>
              <GameCard cardId={id} card={held.card} onSelect={() => onChange(deck.filter((_, at) => at !== index))} />
              {/* 색이 아니라 글자다 — 색만으로는 흑백에서 규칙이 사라진다(R-26의 채널 규칙) */}
              {alien && <em>호의 안 오름</em>}
            </span>
          );
        })}
      </div>
      <button type="button" onClick={onRestore}>규칙 덱으로</button>
      {/* 124장을 한 화면에 깔지 않는다 — 조합 선택과 같은 버튼 줄이 신 다섯으로 거른다 */}
      <div className="god-legend" role="group" aria-label="신별 카드">
        {gods.map((god) => (
          <button
            key={god}
            type="button"
            aria-pressed={tab === god}
            style={{ "--god-color": `var(--${god})` } as CSSProperties}
            onClick={() => setTab(god)}
          >
            <i />
            {godName(god)}
          </button>
        ))}
      </div>
      <CardRow
        cards={list}
        options={list.map(({ id }) => id)}
        onSelect={(id) => onChange([...deck, id].slice(-deckSize))}
      />
    </details>
  );
}

/**
 * 호의 100을 둘에게 나눈다. **슬라이더는 하나다** — 한쪽을 정하면 나머지가 정해진다. 둘을 두면
 * 합을 100으로 맞추는 일이 플레이어 몫이 되고, 그건 결정이 아니라 산수다.
 *
 * 양 끝 라벨이 값과 **단계 이름**을 든다 — 「70 · 헌신」이 미는 동안 실시간으로 바뀌는 것이 이 축을
 * 가르치는 유일한 문서다. 눈금 셋은 `favorBoundaries`에서 온다: 위치를 CSS에 박으면 규칙이 바뀔 때
 * 화면만 옛 자리에 남는다. **폼 컨트롤이므로 라이브러리를 안 쓴다**.
 *
 * 조합이 둘이 아니면 **`visibility: hidden`으로 자리만 지킨다** — 둘째 신을 고르는 클릭에 이 블록이
 * 끼어들어 시드·「런 시작」이 밀려 내려가면 안 된다(UI.md 제1규칙). 숨은 동안의 라벨은 어차피 안
 * 보이므로 엔진 순서의 앞 둘로 채워 높이만 같게 둔다
 */
function SplitField({ pair, split, onChange }: { pair?: PatronPair; split: number; onChange: (split: number) => void }) {
  const shown = pair ?? (gods.slice(0, 2) as unknown as PatronPair);
  return (
    <label className="split-field" style={pair ? undefined : { visibility: "hidden" }}>
      시작 호의 배분 — 합은 언제나 {favorPool}입니다
      <span className="split-ends">
        {shown.map((god, index) => {
          const value = index === 0 ? split : favorPool - split;
          return (
            <b key={god} className={favorStage(value)} style={{ "--god-color": `var(--${god})` } as CSSProperties}>
              <i />{godName(god)} {value} · {stageName[favorStage(value)]}
            </b>
          );
        })}
      </span>
      <span className="split-track">
        <input type="range" min={0} max={favorPool} value={split} onChange={(event) => onChange(Number(event.target.value))} />
        {Object.values(favorBoundaries).filter((at) => at > 0).map((at) => <i key={at} style={{ left: `${at}%` }} />)}
      </span>
    </label>
  );
}

interface SetupScreenProps {
  picked: GodId[];
  deck: string[];
  /** 정규화된 조합. 둘을 안 골랐으면 없다 — 배분은 신 이름 둘이 있어야 뜻을 갖는다 */
  pair?: PatronPair;
  split: number;
  onSplitChange: (split: number) => void;
  onToggleGod: (god: GodId) => void;
  onDeckChange: (deck: string[]) => void;
  onRestoreDeck: () => void;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
}

/** 선택된 초상 위 신 테마 프롭(P-58 §12) — 있는 14종에서 신마다 하나씩 물었다. 새 에셋 0 */
const godTheme: Record<GodId, string> = {
  zeus: "surface_lightning_afterglow",
  poseidon: "under_droplet",
  athena: "surface_olive_leaf",
  ares: "under_ash",
  artemis: "surface_eagle",
};

/**
 * 신 선택 = 캐릭터 셀렉트(P-56). 일러 다섯(1024×1536)이 화면의 주인공이다 — h1·lead·토큰 범례·
 * 시드 입력·힌트는 지웠다(설명은 P-53 도움말, 시드는 런 시작 때 App이 뽑는다). 선택 로직 불변:
 * `toggleGod`의 `slice(-2)` · `aria-pressed` · 엔진 `gods` 순서 — **버튼이 그림이 될 뿐이다**
 */
export function SetupScreen({
  picked,
  deck,
  pair,
  split,
  onSplitChange,
  onToggleGod,
  onDeckChange,
  onRestoreDeck,
  onStart,
}: SetupScreenProps) {
  return (
    <>
      <Backdrop src={hero("title")} tone="hero" />
      <form className="shell setup" onSubmit={onStart}>
      <p className="pick-label" id="patron-pick">후원할 신 둘 · {picked.length}/2</p>
      {/*
        이름은 `data/gods.json`, 색은 `--{id}` CSS 변수다 — 둘 다 화면에 다시 적지 않는다.
        순서도 **엔진의 `gods`**에서 온다. 「선택 N」 배지는 data-pick + CSS content다 —
        DOM 텍스트에 섞으면 e2e가 이름으로 버튼을 못 집는다
      */}
      <div className="god-select" role="group" aria-labelledby="patron-pick">
        {gods.map((god, index) => {
          const { start, turn } = godStageText(god, "devotion");
          return <Fragment key={god}>
            {index > 0 && <i className="god-divider" aria-hidden="true" />}
            <button
              type="button"
              className="god-portrait"
              aria-pressed={picked.includes(god)}
              aria-labelledby={`${god}-name`}
              aria-describedby={picked.includes(god) ? `${god}-ability` : undefined}
              data-pick={picked.includes(god) ? picked.indexOf(god) + 1 : undefined}
              style={{ "--god-color": `var(--${god})` } as CSSProperties}
              onClick={() => onToggleGod(god)}
            >
              <img src={godArt[`../../art/gods/${god}.webp`]} alt="" />
              {/* 선택된 초상 위 신 테마 프롭 — absolute라 자리를 안 민다(UI.md 제1규칙) */}
              {picked.includes(god) && <Prop name={godTheme[god]} className="god-theme" />}
              <span className="nameplate">
                <b id={`${god}-name`}>{godName(god)}</b>
                {picked.includes(god) && (
                  <small className="god-ability" id={`${god}-ability`}>
                    헌신 능력 · 시작 {start} · {interventionEveryTurns}턴마다 {turn}
                  </small>
                )}
              </span>
            </button>
          </Fragment>;
        })}
      </div>
      {/* 하단 한 줄 — 배분 슬라이더(둘 골라야 등장, 자리는 지킨다) · 덱 편집기(접힘) · 런 시작 */}
      <div className="setup-row">
        <SplitField pair={pair} split={split} onChange={onSplitChange} />
        <DeckEditor deck={deck} picked={picked} onChange={onDeckChange} onRestore={onRestoreDeck} />
        <button className="primary" type="submit" disabled={picked.length !== 2 || deck.length !== deckSize}>런 시작</button>
      </div>
      </form>
    </>
  );
}

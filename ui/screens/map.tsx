import { m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { bossLane, floorsPerRegion, laneCount, mapSlot, type MapGrid, type MapNodeType } from "../../core/map.ts";
import type { MapDecision } from "../../sim/engine.ts";
import { Backdrop, backdropArt, Flanks, Prop } from "../shared/backdrop.tsx";
import { regionName } from "../shared/header.tsx";
import { Icon } from "../shared/icon.tsx";
import { playSound } from "../shared/sfx.ts";

const laneName = ["왼쪽", "가운데", "오른쪽"];
const nodeLabel: Record<MapNodeType, string> = { combat: "전투", elite: "정예", rest: "쉼터", omen: "예고", boss: "보스" };
const nodeDetail: Record<MapNodeType, string> = {
  combat: "보상을 노리고 위험을 감수합니다.",
  elite: "더 강한 편성입니다. 보상은 전투와 같습니다.",
  rest: "체력을 회복하거나 카드를 지웁니다.",
  omen: "신이 한 번 더 조건을 겁니다. 무엇인지는 들어가야 압니다.",
  boss: "지역의 끝입니다.",
};

/**
 * 마커 이동. `motion`의 layout이 JS로 보간하므로 시간이 CSS에 없다 — `--ease-in-out`과 같은 곡선이다.
 * 0.5초는 **걷는 속도다**(P-63) — 이 값이 곧 화면이 넘어가기까지의 대기이기도 하다
 */
const markerTransition = { duration: 0.5, ease: [0.77, 0, 0.175, 1] } as const;

export function MapScreen({ decision, onChoosePath }: {
  decision: MapDecision;
  onChoosePath: (choice: string) => void;
}) {
  const view = decision.observation;
  return (
    // 격자가 유일한 조작 면이다 — 패널이 하나뿐이라 `run-layout`(2열)을 쓰면 오른쪽 칸이 통째로 빈다.
    // 제목이 없다(P-54) — 격자 자체가 「경로 선택」을 말하고, 위치는 상태 바가 든다
    <>
      <Backdrop src={backdropArt(view.region, "map")} />
      <div className="shell run">
        {/* 패널 좌우 원경 2 + 보스 층 줄 옆 신호 프롭(P-58) — 끝이 가까워지는 감각 */}
        <Flanks region={view.region} depth={view.depth} />
        <div className="map-wrap">
          {/* 지금 서 있는 칸은 **직전 층의** 걸어온 갈래다 — `view.depth`는 지금 고르는 층이다 */}
          <MapPanel
            /**
             * **층이 바뀌면 격자는 새 것이다.** 화면 key가 `"map"` 하나라 층이 이어지면(예고 칸이
             * 아무 조건도 안 걸고 지나가는 자리) 컴포넌트가 안 갈리고 `moving`이 남는다 — 그러면
             * 새 층의 칸이 전부 `disabled`인 채로 서고 아무도 누를 수 없다(브라우저 실측)
             */
            key={view.depth}
            grid={view.grid}
            region={view.region}
            here={{ depth: view.depth - 1, lane: view.lane }}
            open={{ depth: view.depth, options: decision.options }}
            onEnter={onChoosePath}
          />
          <Prop name={view.region === "surface" ? "surface_storm_cloud" : "under_tartarus_glow"} className="boss-signal" />
        </div>
      </div>
    </>
  );
}

/**
 * 지역 여섯 층 × 세 갈래를 한눈에 깐다 — 슬레이 더 스파이어 방식이다. 그래야 「3층에서 왼쪽으로
 * 가면 정예를 밟지만 5층 쉼터에 닿는다」가 성립한다. 지나온 지역은 결과 화면에서 둘 다 보인다.
 *
 * `onEnter`가 오면 **격자가 곧 조작 면이다** — 칸이 `<button>`이 되고 누르면 마커가 그 칸으로 걸어간
 * 다음에 화면이 넘어간다. 결과 화면은 그것을 안 주므로 같은 격자가 읽는 그림으로 남는다
 */
export function MapPanel({ grid, region, open, here, taken = [], onEnter }: {
  grid: MapGrid;
  region: string;
  /** 지금 고를 수 있는 갈래. `"lane:type"` 그대로 든다 — 격자에서 되만들면 두 번째 진실이 생긴다 */
  open?: { depth: number; options: string[] };
  /** 병사가 **지금 서 있는** 칸 하나. 마커가 여기에만 선다 — 걸어온 길 전부는 `taken`이 든다 */
  here?: { depth: number; lane: number };
  /** `depth` → 지나온 갈래. 결과 화면이 걸어온 길을 여기로 표시한다 */
  taken?: (number | undefined)[];
  /** 열린 칸을 누를 수 있게 한다. 없으면 격자는 읽는 그림이다(결과 화면) */
  onEnter?: (option: string) => void;
}) {
  const base = region === "surface" ? floorsPerRegion : 0;
  /** 걸어가는 중인 갈래(`"lane:type"`). 서면 전 칸이 잠기고 마커가 그 칸으로 간다 */
  const [moving, setMoving] = useState<string>();
  const reducedMotion = useReducedMotion();
  const at = moving && open ? { depth: open.depth, lane: Number(moving.split(":")[0]) } : here;
  const standing = (depth: number, lane: number) => at?.depth === depth && at.lane === lane;
  /**
   * 시작 칸. **`here.depth`가 이 지역 밖일 때만** 선다 — 저승 1층은 −1이고 지상 1층은 직전이 저승
   * 보스(5)라 둘 다 이 격자에 자리가 없다. 「`depth === 0`」으로 적으면 지상 1층이 다시 빈다
   */
  const start = here && (here.depth < base || here.depth >= base + floorsPerRegion) ? here : undefined;
  /**
   * 마커는 **하나**다. `moving`이 그것을 다른 칸의 자식으로 옮기기만 하고 두 위치 사이는 `motion`의
   * layout이 잇는다 — 좌표도 keyframes도 없다. 끝나는 신호도 거기서 오므로 시간이 한 곳에만 적힌다
   */
  const marker = (
    <m.span
      className="marker"
      layoutId="run-marker"
      transition={reducedMotion ? { duration: 0 } : markerTransition}
      onLayoutAnimationComplete={() => moving && onEnter?.(moving)}
    />
  );
  return (
    <div className={`map-panel${onEnter ? " walkable" : ""}`}>
      {/**
       * 제목은 **읽는 격자에만** 남는다(P-63). 경로 화면은 격자가 보이는데 격자의 크기를 글로 다시
       * 적고 있었고, 지역은 상태 바가 든다. 결과 화면은 두 지역을 나란히 세우므로 어느 쪽이 저승인지를
       * 말할 것이 이 줄뿐이다 — 여기서 지우면 격자 둘이 이름 없이 선다
       */}
      {!onEnter && <h2>{regionName(region)} 6층 × 3갈래</h2>}
      <ol>
        {/* 위에서 아래로 6층 → 1층. 오르는 방향과 화면 방향이 같다 */}
        {Array.from({ length: floorsPerRegion }, (_, index) => {
          const depth = base + floorsPerRegion - 1 - index;
          const row = grid[depth] ?? [];
          return (
            <li key={depth}>
              {Array.from({ length: laneCount }, (_, lane) => {
                const type = row[lane];
                const option = open?.depth === depth ? open.options.find((choice) => choice.startsWith(`${lane}:`)) : undefined;
                const className = `map-node${type ? ` ${type}` : " empty"}${taken[depth] === lane ? " current" : ""}${standing(depth, lane) ? " here" : ""}${option ? " open" : ""}`;
                // 읽는 그림에서는 칸이 16px 아이콘 하나다 — 이름은 `title`이 든다. `omen`도 「예고」까지는
                // 말한다: 감추는 것은 종류가 아니라 그 안의 내용이다
                if (!onEnter || !type) {
                  return (
                    <i className={className} key={lane} title={type ? nodeLabel[type] : undefined}>
                      {type ? <Icon name={type} /> : ""}
                      {standing(depth, lane) && marker}
                    </i>
                  );
                }
                return (
                  <button
                    className={className}
                    key={lane}
                    type="button"
                    // 이동이 시작되면 **전 칸이** 잠긴다 — 두 번 눌러 같은 결정이 둘 나가는 것을 막는다
                    disabled={!option || moving !== undefined}
                    // 격자에서는 위치가 곧 갈래다. 스크린리더에는 격자가 없으므로 갈래 이름이 여기 남는다
                    aria-label={`${laneName[lane]} · ${nodeLabel[type]} · ${nodeDetail[type]}`}
                    onClick={() => {
                      playSound("chips-handle-4", 0.45);
                      if (reducedMotion) onEnter(option!);
                      else setMoving(option);
                    }}
                  >
                    <Icon name={type} />
                    <b>{nodeLabel[type]}</b>
                    {standing(depth, lane) && marker}
                  </button>
                );
              })}
            </li>
          );
        })}
        {start && (
          <li className="start">
            {/* 지상 1층의 그 자리는 방금 지나온 저승 보스다 — 보스도 런 시작 `lane`도 `bossLane`이라 칸 위치가 같다 */}
            <small>{start.depth < 0 ? "시작" : `${regionName(mapSlot(start.depth).region)}에서`}</small>
            {Array.from({ length: laneCount }, (_, lane) => (
              <i className={`map-node${lane === bossLane ? "" : " empty"}${standing(start.depth, lane) ? " here" : ""}`} key={lane}>
                {standing(start.depth, lane) && marker}
              </i>
            ))}
          </li>
        )}
      </ol>
    </div>
  );
}

/**
 * `pathChoices`는 보스 층을 빼고 순서대로 쌓인다 — 보스는 물을 것이 없어 기록이 없다.
 * 그래서 깊이를 훑으며 하나씩 꺼내고 보스 층은 `bossLane`으로 채운다
 */
export function takenLanes(grid: MapGrid, pathChoices: string[], reached: number): (number | undefined)[] {
  const remaining = [...pathChoices];
  return Array.from({ length: grid.length }, (_, depth) => {
    const lane = mapSlot(depth).floor === floorsPerRegion ? bossLane : Number(remaining.shift()?.split(":")[0]);
    return depth < reached && Number.isInteger(lane) ? lane : undefined;
  });
}

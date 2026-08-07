import { finishRestFavor } from "./favor.ts";
import { createRng } from "./rng.ts";
import { upgradeId } from "./rules.ts";
import type { GameState } from "./state.ts";

export const regions = ["underworld", "surface"] as const;
export const floorsPerRegion = 6;
/** 런 하나의 칸 수. 12를 손으로 적는 자리가 곧 두 번째 진실이다 */
export const mapDepth = regions.length * floorsPerRegion;
/**
 * 한 층의 갈래 수. StS의 7칸을 우리 크기로 줄인 것이고 `lane ±1` 규칙이 여기에 걸린다.
 *
 * **다이얼이 아니다** — `assignments`의 세 겹 루프와 `bossRow`, `ui/app.tsx`의 `laneName`이 3을 박아
 * 뒀다. 읽는 쪽(도달 가능성·격자 순회)이 이름으로 읽게 두고 만드는 쪽은 그때 같이 고친다
 */
export const laneCount = 3;
/**
 * 보스가 서는 갈래. 어느 갈래에서도 `lane ±1`로 닿으므로 이 상수 하나가 곧 「6층 수렴」이고
 * 「모든 갈래에서 보스까지 경로가 있다」의 증명이다 — 막다른 길이 구조적으로 불가능하다
 */
export const bossLane = 1;
export const restHealing = 25;
/**
 * 0.55 → **0.38**(P-41) — 조우가 1.7인에서 4인이 되어 때리는 입이 2.3배가 됐다. 개체 damage를 인원만큼
 * 내려도 `Math.ceil`이 네 번 올림해 한 턴 피해가 그대로 오른다: 이 배율이 그 몫을 되돌린다.
 * 값은 (체력 배수 × 피해 배율) 격자 25점 실측에서 일곱 지표가 동시에 서는 유일한 행이다(reviews/41-pack.md §밸런싱)
 */
export const enemyDamageScale = 0.38;
export type MapNodeType = "combat" | "elite" | "rest" | "omen" | "boss";
/** `[depth][lane]`. `null`은 그 갈래에 칸이 없다는 뜻이다 — 보스 층이 유일하다 */
export type MapGrid = (MapNodeType | null)[][];
/** 정예·휴식. StS의 「연속으로 못 온다」가 이 둘을 묶어 본다 */
const heavy = (type: MapNodeType | null) => type === "elite" || type === "rest";

export function mapSlot(depth: number): { region: (typeof regions)[number]; floor: number } {
  if (depth < 0 || depth >= mapDepth) throw new Error(`Invalid map depth: ${depth}`);
  return { region: regions[Math.floor(depth / floorsPerRegion)], floor: (depth % floorsPerRegion) + 1 };
}

/**
 * `depth`에 들어갈 수 있는 갈래. 직전 갈래에서 `±1`이고 보스 층은 하나로 수렴한다.
 * 런 시작과 지역 전환은 직전 갈래가 `bossLane`이라 자동으로 세 갈래가 다 열린다 — StS의 「1층은
 * 어디로든 시작할 수 있다」에 특수 분기가 필요 없는 이유다
 */
export function reachableLanes(depth: number, lane: number): number[] {
  if (mapSlot(depth).floor === floorsPerRegion) return [bossLane];
  return [lane - 1, lane, lane + 1].filter((next) => next >= 0 && next < laneCount);
}

/**
 * 그 층에 놓을 수 있는 종류. 정예는 **데이터가 그 층에 편성을 준 곳에만** 온다 — 층을 코드로 열고
 * 데이터로 닫으면 `encounter()`가 없는 편성을 찾는다
 */
function allowedTypes(region: string, floor: number, eliteSlots: ReadonlySet<string>): MapNodeType[] {
  if (floor === floorsPerRegion) return ["boss"];
  if (floor === 1) return ["combat"];
  if (floor === 2) return ["combat", "omen"];
  return eliteSlots.has(`${region}:${floor}`) ? ["combat", "elite", "rest", "omen"] : ["combat", "rest", "omen"];
}

/**
 * 그 층의 후보 배치 전부. 「한 층의 갈래는 서로 다른 종류」(하데스의 같은 보상 금지)를 놓을 수 있는
 * 종류 수까지만 요구한다 — 1층은 `combat` 하나뿐이고 2층은 둘뿐이라 셋을 강요하면 배치가 없다
 */
function assignments(allowed: MapNodeType[], needRest: boolean): MapNodeType[][] {
  const distinct = Math.min(laneCount, allowed.length);
  const rows: MapNodeType[][] = [];
  for (const left of allowed) {
    for (const middle of allowed) {
      for (const right of allowed) {
        const row = [left, middle, right];
        if (new Set(row).size < distinct || (needRest && !row.includes("rest"))) continue;
        rows.push(row);
      }
    }
  }
  return rows;
}

/** 이어진 칸 둘이 다 정예·휴식이면 안 된다. `lane ±1`이 곧 연결이라 같은 층 안은 보지 않는다 */
function edgesOk(upper: (MapNodeType | null)[], lower: (MapNodeType | null)[]): boolean {
  return upper.every((type, lane) => !heavy(type) || [lane - 1, lane, lane + 1].every((next) => !heavy(lower[next])));
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

/**
 * 배치 규칙 일곱을 격자 위에서 다시 잰다. 생성기가 만족시키는 성질을 생성기가 검사하는 것이고,
 * 그래야 규칙이 문서가 아니라 게이트다 — 탐색이 바뀌어도 여기서 걸린다
 */
export function mapLayoutFailure(grid: MapGrid): string | undefined {
  // 꼴부터 잰다 — 빈 격자는 규칙 일곱을 한 번도 안 거치고 통과하고, 긴 격자는 `mapSlot`이 던진다
  if (grid.length !== mapDepth) return `grid must be ${mapDepth} deep`;
  let reach = reachableLanes(0, bossLane);
  for (let depth = 0; depth < grid.length; depth += 1) {
    const { floor } = mapSlot(depth);
    const row = grid[depth];
    if (row.length !== laneCount) return `depth ${depth}: lane count`;
    const boss = floor === floorsPerRegion;
    // 7 · 도달 가능성: 비보스 층은 세 갈래가 다 서고 보스 층은 bossLane 하나만 선다. 이 둘이면
    // `lane ±1`에서 막다른 길이 없다 — 어느 갈래에서도 다음 층의 세 갈래 중 둘 이상에 닿는다
    if (row.filter((type) => type !== null).length !== (boss ? 1 : laneCount)) return `depth ${depth}: node count`;
    if (boss && row[bossLane] !== "boss") return `depth ${depth}: boss must converge on lane ${bossLane}`;
    if (!boss && row.includes(null)) return `depth ${depth}: missing lane`;
    if (floor === 1 && row.some((type) => type !== "combat")) return `depth ${depth}: floor 1 must be all combat`;
    if (floor < 3 && row.some(heavy)) return `depth ${depth}: elite and rest start on floor 3`;
    if (floor === floorsPerRegion - 1 && !row.includes("rest")) return `depth ${depth}: floor 5 needs a rest`;
    const distinct = new Set(row.filter((type) => type !== null)).size;
    if (distinct < (floor === 1 || boss ? 1 : floor === 2 ? 2 : 3)) return `depth ${depth}: lanes repeat a type`;
    if (depth > 0 && !edgesOk(grid[depth - 1], row)) return `depth ${depth}: elite/rest follows elite/rest`;
    if (!reach.some((lane) => row[lane] !== null)) return `depth ${depth}: unreachable`;
    reach = [...new Set(reach.filter((lane) => row[lane] !== null).flatMap((lane) => (depth + 1 < grid.length ? reachableLanes(depth + 1, lane) : [])))];
  }
  return undefined;
}

/**
 * 시드가 격자를 만든다. 순수 함수인 이유는 `mapNode`가 그랬던 것과 같다 — 재생이 여기 걸려 있다.
 *
 * 층별 후보 배치를 시드로 섞고 이어진 칸 규칙에서 되돌아간다. 탐색 공간이 층당 24개 이하라
 * 되돌아가기가 즉시 끝난다 — StS의 「경로 6회 생성 · 교차 금지」는 6층 × 3갈래에 과하다
 */
export function generateMap(seed: number, eliteSlots: ReadonlySet<string> = new Set()): MapGrid {
  const random = createRng(seed);
  const bossRow: (MapNodeType | null)[] = [null, "boss", null];
  const candidates = Array.from({ length: mapDepth }, (_, depth) => {
    const { region, floor } = mapSlot(depth);
    if (floor === floorsPerRegion) return [bossRow];
    return shuffled(assignments(allowedTypes(region, floor, eliteSlots), floor === floorsPerRegion - 1), random);
  });
  const grid: MapGrid = [];
  const place = (depth: number): boolean => {
    if (depth === candidates.length) return true;
    for (const row of candidates[depth]) {
      if (depth > 0 && !edgesOk(grid[depth - 1], row)) continue;
      grid[depth] = row;
      if (place(depth + 1)) return true;
    }
    grid.length = depth;
    return false;
  };
  if (!place(0)) throw new Error(`generateMap: no layout for seed ${seed}`);
  const failure = mapLayoutFailure(grid);
  if (failure) throw new Error(`generateMap: ${failure}`);
  return grid;
}

/** 고른 갈래로 들어선다. 위치가 곧 상태라 조우 시드와 화면이 같은 사실을 읽는다 */
export function enterNode(state: GameState, lane: number): MapNodeType {
  const { region, floor } = mapSlot(state.map.depth);
  const type = state.map.grid[state.map.depth][lane];
  if (!reachableLanes(state.map.depth, state.map.lane).includes(lane) || type === null) {
    throw new Error(`lane ${lane} is unavailable at ${region} ${floor}`);
  }
  state.map.lane = lane;
  return type;
}

export function advanceMap(state: GameState): void {
  const { region, floor } = mapSlot(state.map.depth);
  state.map.completed.push(`${region}:${floor}:${state.map.lane}:${state.map.grid[state.map.depth][state.map.lane]}`);
  state.map.depth += 1;
}

/**
 * 3택이다. **강화는 덱의 그 자리를 `+N` 붙은 id로 바꾼다** — 지우는 것이 아니라 갈아 끼우는 것이라
 * 덱 길이가 그대로고, 그래야 자유 모드의 열 장이 열 장으로 남는다([P-40](../reviews/40-free.md)).
 * 상한과 융합 제외는 호출자가 `options`로 거른다 — 여기서는 레벨 상한만 문자열로 막는다
 */
export function takeRest(
  state: GameState,
  patrons: string[],
  deck: string[],
  choice: "heal" | "remove" | "upgrade",
  cardId?: string,
): void {
  if (choice === "heal") state.combat.player.hp = Math.min(state.combat.player.maxHp, state.combat.player.hp + restHealing);
  else {
    const index = deck.indexOf(cardId ?? "");
    if (index < 0) throw new Error(`Cannot ${choice} card: ${cardId ?? "none"}`);
    if (choice === "remove") deck.splice(index, 1);
    else deck[index] = upgradeId(deck[index]);
  }
  finishRestFavor(state.favor, patrons);
}

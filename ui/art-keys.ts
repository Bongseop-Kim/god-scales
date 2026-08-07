/**
 * 데이터 id → 파일명. **화면과 게이트가 같은 함수를 부른다** — 규칙이 두 벌이면 「게이트는 통과했는데
 * 화면은 빈다」가 생긴다. 그래서 여기에는 glob도 fs도 없다: `ui/card.tsx`는 Vite glob으로,
 * `tools/art.ts`는 `readdirSync`로 각자 확인하고 **이름 짓는 규칙만** 공유한다
 */
export type CardArtSource = { id: string; patron?: string; patron_pair?: string[]; tags?: string[] };

/**
 * 카드 149개를 그림 30장이 덮는다. **id로 맞는 건 융합 10장뿐이다** — 파일명이 곧 카드 id다.
 * 나머지 139장은 `{patron}_{tag}` 20장으로 떨어진다.
 *
 * P-37이 「융합 파일명의 신 순서가 데이터와 반대다」를 함정으로 적었는데, 실제로 반대인 것은
 * `patron_pair`(9/10이 파일과 순서가 다르다)고 **id는 파일과 정확히 같다.** 그래서 순서를 뒤집어
 * 다시 시도하는 단을 넣지 않았다 — 한 번도 안 타는 폴백이다. 어긋나면 `art --check`가 잡는다
 */
export function cardArtCandidates({ id, patron, tags = [] }: CardArtSource): string[] {
  // 태그를 순서대로 다 시도한다 — `tags[0]`이 `power`인 카드 다섯이 있고 그림은 넷뿐이다
  return [id, ...(patron ? tags.map((tag) => `${patron}_${tag}`) : [])];
}

/** 프레임 색과 파티클이 읽는 신 하나. 융합은 앞의 신을 쓴다 */
export const cardGod = ({ patron, patron_pair }: CardArtSource): string | undefined => patron ?? patron_pair?.[0];

/** 카드 태그 하나에 파티클 한 장. 색은 CSS가 얹는다 — 태그별로 넉 장을 다시 뽑지 않는다 */
export const tagParticle: Record<string, string> = { attack: "slash_01", defend: "window_01", token: "magic_01", utility: "spark_01" };
/** 그림이 있는 태그. 카드가 여럿을 달면 먼저 걸리는 것을 쓴다 — 목록은 위 표가 곧 정본이다 */
export const cardTag = ({ tags = [] }: CardArtSource): string | undefined => tags.find((tag) => tag in tagParticle);

/** 배경·프롭의 지역 접두사. `core/map.ts`의 지역은 `underworld`인데 파일은 `under_`·`under-`다 */
export const artRegion = (region: string): string => (region === "underworld" ? "under" : "surface");
/** 배경 여섯 장의 이름. 쉼터·예고·보상은 배경이 없어 `combat`을 어둡게 깐다 */
export const backdropName = (region: string, spot: "map" | "combat" | "boss"): string =>
  spot === "map" ? `map-${artRegion(region)}` : `${artRegion(region)}-${spot}`;

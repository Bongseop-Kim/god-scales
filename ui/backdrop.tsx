import { artRegion, backdropName } from "./art-keys.ts";

/**
 * 화면 뒤 한 장. **`.shell` 바깥에 선다** — 안에 넣으면 `tools/e2e.ts`의 열 측정(`measure`)이
 * 배경을 세 번째 칸으로 센다. `position: fixed`라 가로 넘침에도 안 잡힌다
 */
const bgArt = import.meta.glob<string>("../art/bg/*.webp", { eager: true, query: "?url", import: "default" });
const propArt = import.meta.glob<string>("../art/props/*.webp", { eager: true, query: "?url", import: "default" });

export const backdropArt = (region: string, spot: "map" | "combat" | "boss") => bgArt[`../art/bg/${backdropName(region, spot)}.webp`];

/** 지역 프롭 일곱. 파일명 접두사가 곧 지역이라 목록을 따로 안 든다 */
const propsOf = (region: string) =>
  Object.keys(propArt).filter((path) => path.startsWith(`../art/props/${artRegion(region)}_`)).sort().map((path) => propArt[path]);

export function Backdrop({ src, region, seed = 0, tone }: {
  src?: string;
  /** 주면 그 지역 프롭 둘이 배경 위에 선다 — 셋 이상은 96px 스프라이트를 가린다 */
  region?: string;
  seed?: number;
  /** `dim`은 배경을 빌려 쓰는 화면, `hero`는 주인공 일러가 주인공인 화면이다. 기본은 전투·지도 */
  tone?: "dim" | "hero";
}) {
  const props = region ? propsOf(region) : [];
  // 층마다 다른 둘. 일곱 중 고르므로 `+3`이 같은 것을 두 번 집는 일은 없다
  const picked = props.length ? [props[seed % props.length], props[(seed + 3) % props.length]] : [];
  return (
    <div className={`backdrop${tone ? ` ${tone}` : ""}`} aria-hidden="true">
      {src && <img className="bg" src={src} alt="" />}
      {picked.map((url, index) => (
        <span key={url} className={`sprite prop p${index}`}><img src={url} alt="" /></span>
      ))}
    </div>
  );
}

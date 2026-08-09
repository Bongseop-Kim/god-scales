import { artRegion, backdropName } from "./art-keys.ts";

/**
 * 화면 뒤 한 장. **`.shell` 바깥에 선다** — 안에 넣으면 `tools/e2e.ts`의 열 측정(`measure`)이
 * 배경을 세 번째 칸으로 센다. `position: fixed`라 가로 넘침에도 안 잡힌다
 */
const bgArt = import.meta.glob<string>("../../art/bg/*.webp", { eager: true, query: "?url", import: "default" });
const propArt = import.meta.glob<string>("../../art/props/*.webp", { eager: true, query: "?url", import: "default" });
const heroArt = import.meta.glob<string>("../../art/hero/*.webp", { eager: true, query: "?url", import: "default" });

/** 주인공 일러 석 장. 인트로·시작·결과 셋이 쓰므로 배경 그림의 집인 여기 산다 */
export const hero = (name: "title" | "win" | "loss") => heroArt[`../../art/hero/hero-${name}.webp`];

export const backdropArt = (region: string, spot: "map" | "combat" | "boss") => bgArt[`../../art/bg/${backdropName(region, spot)}.webp`];

/** 지역 프롭 일곱. 파일명 접두사가 곧 지역이라 목록을 따로 안 든다 */
const propNames = (region: string) =>
  Object.keys(propArt).filter((path) => path.startsWith(`../../art/props/${artRegion(region)}_`)).sort();
const propsOf = (region: string) => propNames(region).map((path) => propArt[path]);

/** n번째 지역 프롭 이름 — 결정 화면의 좌우 1쌍(P-58)이 층 시드로 고른다. `n`은 depth라 음수가 없다 */
const regionProp = (region: string, n: number): string => {
  const list = propNames(region);
  return list[n % list.length].replace(/^.*\/|\.webp$/g, "");
};

/**
 * 화면 프롭 하나(P-58) — 배경과 UI 사이 레이어, 눌리지 않고(`.prop`), 4프레임 steps 루프는
 * `.sprite` 그대로다. 위치·크기는 부르는 쪽의 클래스가 든다
 */
export function Prop({ name, className }: { name: string; className?: string }) {
  const src = propArt[`../../art/props/${name}.webp`];
  return src ? <span className={`sprite prop ${className ?? ""}`} aria-hidden="true"><img src={src} alt="" /></span> : null;
}

/** 패널 좌우 바깥 1쌍(P-58) — 지도·보상·휴식·은혜·과업이 같은 둘을 층 시드로 고른다 */
export function Flanks({ region, depth }: { region: string; depth: number }) {
  return (
    <>
      <Prop name={regionProp(region, depth)} className="flank left" />
      <Prop name={regionProp(region, depth + 3)} className="flank right" />
    </>
  );
}

export function Backdrop({ src, region, seed = 0, tone }: {
  src?: string;
  /** 주면 그 지역 프롭이 배경 위에 선다 — 전투 무대(P-55)만 준다 */
  region?: string;
  seed?: number;
  /**
   * `dim`은 배경을 빌려 쓰는 화면, `hero`는 주인공 일러가 주인공인 화면, `stage`는 전투 무대(.55),
   * `aim`은 대상 선택 중의 무대(.35 — 대상 아닌 것이 어두워진다). 기본은 지도
   */
  tone?: "dim" | "hero" | "stage" | "aim";
}) {
  const props = region ? propsOf(region) : [];
  // 시드는 음수도 온다(`ui/app.tsx`는 정수만 본다) — `%`가 음수를 내면 `props[-2]`가 빈 `src`가 된다
  const pick = (offset: number) => props[(((seed + offset) % props.length) + props.length) % props.length];
  /**
   * 프롭 3겹 5개(P-55) — 원경 2(상단, 작게) · 중경 1(적 뒤) · 전경 2(발밑, blur). 일곱 중
   * 고르고 오프셋 `i * 3`은 mod 7에서 전부 다른 칸이라 같은 프롭이 두 번 서지 않는다.
   * 위치는 겹별 범위 안에서 층 시드로 셔플된다 — 겹이 곧 크기라 CSS의 `p0~p4`가 든다
   */
  const picked = props.length ? Array.from({ length: 5 }, (_, index) => pick(index * 3)) : [];
  const jitter = (salt: number, lo: number, hi: number) => lo + ((Math.abs(seed) * 31 + salt * 17) % 97) / 97 * (hi - lo);
  const spots = [
    { top: `${jitter(0, 18, 28)}%`, left: `${jitter(1, 44, 52)}%` },
    { top: `${jitter(2, 18, 28)}%`, left: `${jitter(3, 56, 66)}%` },
    { top: `${jitter(4, 38, 48)}%`, left: `${jitter(5, 62, 82)}%` },
    { top: `${jitter(6, 72, 78)}%`, left: `${jitter(7, 3, 16)}%` },
    { top: `${jitter(8, 78, 88)}%`, left: `${jitter(9, 76, 90)}%` },
  ] as const;
  return (
    <div className={`backdrop${tone ? ` ${tone}` : ""}`} aria-hidden="true">
      {src && <img className="bg" src={src} alt="" />}
      {picked.map((url, index) => (
        <span key={`${url}-${index}`} className={`sprite prop p${index}`} style={spots[index]}><img src={url} alt="" /></span>
      ))}
    </div>
  );
}

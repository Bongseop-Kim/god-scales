/**
 * game-icons.net 28개를 **symbol 시트 한 장**으로 받는다 — `art/icons.svg`.
 *
 * 슬러그를 추측하지 않았다: `data.jsdelivr.com`의 파일 목록(4229개)에서 실제로 존재하는 이름만 골랐고,
 * 이 스크립트가 하나라도 404거나 배경 사각형 형태가 다르면 던진다. **폴백이 조용히 뜨는 길을 막는 게
 * 이 파일의 절반이다** — 나머지 절반은 `public/ATTRIBUTION.md`가 읽을 저자 표다.
 *
 * 원본은 `<svg viewBox="0 0 512 512"><path d="M0 0h512v512H0z"/><path fill="#fff" …/></svg>` 꼴이다.
 * 검은 배경 사각형을 떼고 `fill="#fff"`를 지우면 남은 path가 `currentColor`를 물려받는다
 */
import { writeFileSync } from "node:fs";

/**
 * 배지 채움색은 진영이고 테두리는 신이므로(R-26 §배지) **신을 가르는 건 형태뿐이다.** 그래서 같은 신의
 * 토큰끼리 계열을 맞췄다 — 아테나는 방패·기하(벽·반사·가시 고리), 아레스는 피·칼날, 아르테미스는 조준.
 *
 * **접촉 시트로 실물을 보고 일곱 개를 갈았다**(R-33): 얇은 선이 많은 후보는 14~24px에서 다 뭉갠다.
 * 번개는 갈래가 여럿인 것 대신 굵은 지그재그로, 출혈은 상처 선 대신 흐르는 덩어리로 갔다
 */
const icons: Record<string, string> = {
  // 토큰 10 — 38px 배지 안 24px
  shock: "lorc/lightning-helix",
  displace: "lorc/big-wave",
  soaked: "sbed/water-drop",
  // 「방벽」은 방패가 아니라 벽이다 — 의도 «방어»가 방패를 쓰므로 한 화면에 방패 둘이 서면 안 된다
  bulwark: "delapouite/brick-wall",
  deflect: "lorc/shield-reflect",
  thorns: "lorc/crown-of-thorns",
  // 제우스·포세이돈 공유라 신 계열이 없다 — 「굵어진 팔」이 형태만으로 「내가 커졌다」로 읽힌다
  might: "delapouite/mighty-force",
  bleed: "skoll/blood",
  frenzy: "delapouite/claws",
  mark: "delapouite/crosshair",
  crit: "skoll/bullseye",
  // 적 전용 둘. 자원을 빼앗는 쪽이라 신 계열이 없다 — 형태만으로 「빈 병」·「가린 눈」이 읽혀야 한다
  drain: "lorc/empty-hourglass",
  fog: "lorc/dust-cloud",
  // 패시브 8 — 14px. 토큰보다 더 단순한 것을 골랐다
  guard: "delapouite/closed-barbute",
  shell: "lorc/scale-mail",
  ward: "lorc/rune-stone",
  curl: "delapouite/armadillo",
  angry: "lorc/screaming",
  rally: "delapouite/mighty-horn",
  ramp: "delapouite/upgrade",
  spite: "lorc/cloak-dagger",
  // 의도 5 — 16px. `EnemyAction`의 네 필드 + 「대기」다(계획의 «강화»는 코드에 없다)
  damage: "lorc/broadsword",
  block: "sbed/shield",
  heal: "sbed/health-increase",
  token: "lorc/magic-swirl",
  idle: "lorc/hourglass",
  // 판 밖으로 나가는 의도 하나 — 기도가 끊긴다. 「대기」로 떨어지면 화면이 거짓말을 한다
  favor: "lorc/prayer",
  // 맵 노드 5 — 격자 16px + 선택지 24px. `elite`↔`combat`은 색이 거의 같아 형태로만 갈린다
  combat: "lorc/crossed-swords",
  elite: "lorc/crowned-skull",
  rest: "lorc/campfire",
  omen: "lorc/hidden",
  boss: "lorc/dragon-head",
};

/** 저자 폴더 → 표기 이름. 넷 다 CC BY 3.0이다(CC0인 viscious-speed·zeromancer는 안 골랐다) */
const authors: Record<string, string> = { lorc: "Lorc", delapouite: "Delapouite", sbed: "Sbed", skoll: "Skoll" };

const background = '<path d="M0 0h512v512H0z"/>';

/**
 * 받아오는 자리를 **커밋에 못 박는다.** `@master`는 움직이므로 같은 스크립트가 다음 달에 다른 그림을
 * 뱉는다 — 시트를 다시 뽑는 일이 재현이 되려면 이 한 줄이 판이어야 한다
 */
const revision = "82d948812bfe3f269ef8f731dcdb07b08160edc4";

async function symbol(id: string, slug: string): Promise<string> {
  const response = await fetch(`https://cdn.jsdelivr.net/gh/game-icons/icons@${revision}/${slug}.svg`);
  if (!response.ok) throw new Error(`${slug} — ${response.status}. 없는 슬러그다`);
  const source = await response.text();
  const body = source.replace(/^.*?<svg[^>]*>/s, "").replace("</svg>", "").trim();
  if (!body.startsWith(background)) throw new Error(`${slug} — 배경 사각형이 앞에 없다. 형태가 바뀌었다`);
  return `<symbol id="icon-${id}" viewBox="0 0 512 512">${body.slice(background.length).replaceAll(' fill="#fff"', "")}</symbol>`;
}

/**
 * `tools/art.ts`가 시트를 이 목록과 대조한다 — 하나 빠지면 화면에 빈 자리가 조용히 뜬다.
 * **곁가지가 다 깃발 뒤에 있는 이유가 이것이다**: 게이트가 이 파일을 들여올 때 받아오기가 돌면 안 된다
 */
export const iconIds = Object.keys(icons);

if (process.argv.includes("--fetch")) {
  const symbols = await Promise.all(Object.entries(icons).map(([id, slug]) => symbol(id, slug)));
  writeFileSync("art/icons.svg", `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>\n`);
  console.log(`icons=${symbols.length}`);
}

if (process.argv.includes("--credits")) {
  console.log("| 자리 | 아이콘 | 저자 |\n|---|---|---:|");
  for (const [id, slug] of Object.entries(icons)) {
    const [author, name] = slug.split("/");
    console.log(`| \`${id}\` | [${name}](https://game-icons.net/1x1/${author}/${name}.html) | ${authors[author]} |`);
  }
}

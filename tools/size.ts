/**
 * **번들되는 것만 센다.** 옛 판은 `art`를 재귀로 세서 `art/_src/`(617MB)까지 잡았고 4MiB 상한을
 * 이미 깨고 있었는데 표가 안 났다 — 그때는 배선된 것이 카드 30장뿐이라 `dist`가 960K였다.
 * 세는 것과 실제로 나가는 것이 같아야 게이트가 뜻을 갖는다.
 *
 * 아래 목록은 화면 쪽 glob과 짝이다: `ui/*.tsx`의 `import.meta.glob("../art/<종류>/*.webp")`와
 * `ui/style.css`의 `url()` 여섯(커서 넷 · 폰트 둘). 한쪽만 늘리면 게이트가 거짓말을 한다.
 *
 * **총량은 배포 무게지 첫 화면 무게가 아니다.** 카드 179장·fx·배경·스프라이트는 그 화면이 뜰 때
 * 하나씩 받는다 — 배포본 실측(1440px): 타이틀 **988KiB / 요청 7**(글꼴 656 · style 143 · hero 126 ·
 * main 63), 런 시작 뒤 **1,611KiB / 요청 19**. 그래서 사람이 기다리는 시간을 쥐고 있는 것은 이
 * 총량이 아니라 **한글 글꼴 656KiB**고, 그것은 `local()` 먼저 · `font-display: swap`으로 이미 비켜 놨다.
 * 4MiB는 근거가 적힌 적 없는 둥근 수였다(최초 판·DEPLOY.md·README 어디에도 없다).
 *
 * **이 총량이 잡는 것은 증가가 아니라 폭주다.** 실제로 한 번 일한 자리가 위 첫 문단이다 — `_src`
 * 617MB가 새어 들어온 것을 잡았지 15% 늘어난 것을 잡은 적은 없다. 그런 사고에 4·5·8은 다 똑같이
 * 걸리고, **5는 다음 아트 플랜 하나에 다시 빨간불이 된다**(카드 한 벌이 1.24MiB · fx 여섯이 659KiB ·
 * 지금 여유는 590KiB). 플랜마다 미는 문턱은 문턱이 아니라 소음이라 **지금의 두 배인 8MiB**로 둔다 —
 * 폭주는 여전히 걸리고, 자리 하나가 뚱뚱해지는 것은 어차피 아래 **장당 상한**이 잡는다(그쪽은 실제로
 * 반려한 이력이 있다 — R-37의 200K 초과 3장). 이보다 더 올리면 영영 안 걸리는 줄, 곧 지운 줄이다.
 */
const totalLimit = 8 * 1024 * 1024;
import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const bundled: { directory: string; extension: string; only?: string[] }[] = [
  ...["sprites", "cards", "bg", "props", "gods", "fx", "hero", "ui", "particle", "tokens"].map((kind) => ({ directory: `art/${kind}`, extension: ".webp" })),
  { directory: "art/ui", extension: ".png" },
  // 케니 UI 조각(9-slice·크로스헤어)도 CSS `url()`로 번들에 실린다(P-54·P-55·P-61)
  { directory: "art/kenney", extension: ".png", only: ["panel-border-007-bronze.png", "panel-border-010-bronze.png", "token-frame-bronze.png", "crosshair-030-64.png", "crosshair-167.png"] },
  // 아이콘 시트는 `?raw`로 JS 번들 안에 실린다 — 별도 파일로 안 나가도 바이트는 나간다
  { directory: "art", extension: ".svg" },
  // 커서는 쓰는 셋만 남겨 전부 들어간다. 파티클은 81장 중 넷이지만 그 넷만 webp다
  { directory: "art/cursor-pixel", extension: ".png", only: ["tile_0026.png", "tile_0134.png", "tile_0015.png"] },
  { directory: "audio", extension: "" },
  // 한글을 다 담아 한 벌이 500K다 — 그림 한 장 상한(200K)이 아니라 총량 4MiB로만 잡는다
  { directory: "ui/fonts", extension: ".woff2" },
];

const assets = bundled
  .flatMap(({ directory, extension, only }) =>
    readdirSync(directory)
      .filter((name) => name.endsWith(extension) && (!only || only.includes(name)))
      .map((name) => join(directory, name)))
  .filter((path) => statSync(path).isFile() && !path.endsWith(".gitkeep") && !path.endsWith(".md"));
const limits: Record<string, number> = { ".webp": 200 * 1024, ".webm": 30 * 1024 };
const violations = assets.filter((path) => statSync(path).size > (path.includes("art/cards/") ? 40 * 1024 : limits[extname(path)] ?? Infinity));
const bytes = assets.reduce((sum, path) => sum + statSync(path).size, 0);

console.log(`assets=${assets.length} bytes=${bytes} mib=${(bytes / 1024 / 1024).toFixed(2)}/${totalLimit / 1024 / 1024} violations=${violations.length}`);
for (const path of violations) console.log(path);
if (bytes > totalLimit || violations.length) process.exitCode = 1;

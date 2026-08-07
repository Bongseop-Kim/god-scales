/**
 * **번들되는 것만 센다.** 옛 판은 `art`를 재귀로 세서 `art/_src/`(617MB)까지 잡았고 4MiB 상한을
 * 이미 깨고 있었는데 표가 안 났다 — 그때는 배선된 것이 카드 30장뿐이라 `dist`가 960K였다.
 * 세는 것과 실제로 나가는 것이 같아야 게이트가 뜻을 갖는다.
 *
 * 아래 목록은 화면 쪽 glob과 짝이다: `ui/*.tsx`의 `import.meta.glob("../art/<종류>/*.webp")`와
 * `ui/style.css`의 `url()` 여섯(커서 넷 · 폰트 둘). 한쪽만 늘리면 게이트가 거짓말을 한다
 */
import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const bundled: { directory: string; extension: string; only?: string[] }[] = [
  ...["sprites", "cards", "bg", "props", "gods", "fx", "hero", "ui", "particle"].map((kind) => ({ directory: `art/${kind}`, extension: ".webp" })),
  { directory: "art/ui", extension: ".png" },
  // 아이콘 시트는 `?raw`로 JS 번들 안에 실린다 — 별도 파일로 안 나가도 바이트는 나간다
  { directory: "art", extension: ".svg" },
  // 커서는 **쓰는 넷만** 들어간다 — 팩에 220장이 있다. 파티클도 81장 중 넷이지만 그 넷만 webp다
  { directory: "art/cursor-pixel", extension: ".png", only: ["tile_0026.png", "tile_0134.png", "tile_0044.png", "tile_0015.png"] },
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

console.log(`assets=${assets.length} bytes=${bytes} mib=${(bytes / 1024 / 1024).toFixed(2)} violations=${violations.length}`);
for (const path of violations) console.log(path);
if (bytes > 4 * 1024 * 1024 || violations.length) process.exitCode = 1;

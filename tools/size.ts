import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const assets = ["art", "audio"]
  .flatMap((directory) => readdirSync(directory, { recursive: true }).map((name) => join(directory, String(name))))
  .filter((path) => statSync(path).isFile() && !path.endsWith(".gitkeep") && !path.endsWith(".md"));
const limits: Record<string, number> = { ".webp": 200 * 1024, ".webm": 30 * 1024 };
const violations = assets.filter((path) => statSync(path).size > (path.includes("art/cards/") ? 40 * 1024 : limits[extname(path)] ?? Infinity));
const bytes = assets.reduce((sum, path) => sum + statSync(path).size, 0);

console.log(`assets=${assets.length} bytes=${bytes} mib=${(bytes / 1024 / 1024).toFixed(2)} violations=${violations.length}`);
for (const path of violations) console.log(path);
if (bytes > 4 * 1024 * 1024 || violations.length) process.exitCode = 1;

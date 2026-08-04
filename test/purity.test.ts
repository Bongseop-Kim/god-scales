import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const forbidden = [
  "Math.random",
  "Date.now",
  "new Date",
  "fetch(",
  "window.",
  "document.",
  "require(",
  'from "../sim',
  'from "../ui',
  'from "../tools',
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("core purity", () => {
  it("has no impure dependencies", () => {
    for (const file of sourceFiles(resolve("core"))) {
      const source = readFileSync(file, "utf8");
      for (const token of forbidden) expect(source, `${file}: ${token}`).not.toContain(token);
    }
  });
});

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // 두 번째 진입점 — 통계 페이지. 라우터 대신 진입점을 가른다
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        stats: fileURLToPath(new URL("stats.html", import.meta.url)),
      },
    },
  },
  // 밴드 테스트가 2000런 층화 시뮬을 돌린다 — 기본 5초는 토큰 구현 후 런이 길어지며 아슬아슬해졌다
  test: { testTimeout: 120000 }, // CI 러너에서 시뮬 테스트(freeze 35s, matrix 51s)가 30s를 넘긴다
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // 밴드 테스트가 2000런 층화 시뮬을 돌린다 — 기본 5초는 토큰 구현 후 런이 길어지며 아슬아슬해졌다
  test: { testTimeout: 30000 },
});

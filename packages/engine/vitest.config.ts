import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      // WebGL と requestAnimationFrame に触れる層はブラウザで確かめる（画面の撮影で検証する）
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/render/gl/**", "src/engine.ts", "src/device.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@wulu/domain": path.resolve(__dirname, "packages/domain/src/index.ts"),
      "@wulu/news": path.resolve(__dirname, "packages/news/src/index.ts"),
      "@wulu/market-data": path.resolve(__dirname, "packages/market-data/src/index.ts"),
      "@wulu/regime": path.resolve(__dirname, "packages/regime/src/index.ts"),
      "@wulu/strategies": path.resolve(__dirname, "packages/strategies/src/index.ts"),
      "@wulu/backtest": path.resolve(__dirname, "packages/backtest/src/index.ts"),
      "@wulu/confirmation": path.resolve(__dirname, "packages/confirmation/src/index.ts"),
      "@wulu/journal": path.resolve(__dirname, "packages/journal/src/index.ts"),
      "@wulu/options": path.resolve(__dirname, "packages/options/src/index.ts"),
      "@wulu/scanner": path.resolve(__dirname, "packages/scanner/src/index.ts"),
    },
  },





  test: {
    include: ["packages/**/tests/**/*.test.ts", "apps/api/src/**/*.test.ts"],
    environment: "node",
  },
});

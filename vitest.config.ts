import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      // index.ts files are pure re-export barrels; types.ts is type-only and
      // erases to nothing at runtime — neither carries executable statements.
      exclude: ["src/**/index.ts", "src/sprite/types.ts"],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 100,
        lines: 100,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
});

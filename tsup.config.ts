import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "pixi/index": "src/pixi/index.ts",
    "atlas/index": "src/atlas/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  target: "es2022",
  outDir: "dist",
  // pixi.js is an optional peer; the adapter imports it type-only, so nothing
  // pixi-related should reach the bundle. Marked external as belt-and-braces.
  external: ["pixi.js"],
});

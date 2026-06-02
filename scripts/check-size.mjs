#!/usr/bin/env node
// Verify gzip-compressed bundle size per subpath stays under budget.
// Run after `pnpm build`; fails the publish if any entry exceeds.

import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const budgets = {
  // v0.1.0 renderer-agnostic core: the input-driven visual state machine
  // (inputs store, graph compiler/validator, transition resolver, frame-timing
  // engine, typed emitter). Zero runtime dependencies, unminified (gzip does
  // the work, matching aifsmjs). Measured at 3,481 B in v0.1.0; budget set to
  // 3,800 B for a ~320 B safety margin. Tighten in a patch if it shrinks.
  "dist/index.js": 3_800,
  // v0.2.0 PixiJS adapter (aispritejs/pixi). Bundles the core (splitting:false)
  // plus the thin texture/anchor-swapping adapter; pixi.js is type-only and
  // external, so nothing pixi reaches the bundle. Measured at 3,881 B; budget
  // 4,200 B for a ~320 B safety margin.
  "dist/pixi/index.js": 4_200,
};

const failures = [];
for (const [rel, max] of Object.entries(budgets)) {
  const abs = resolve(root, rel);
  let buf;
  try {
    buf = await readFile(abs);
  } catch {
    failures.push(`${rel}: missing (did you run pnpm build?)`);
    continue;
  }
  const gz = gzipSync(buf).length;
  const pct = ((gz / max) * 100).toFixed(0);
  const tag = gz > max ? "FAIL" : "ok  ";
  console.log(`[${tag}] ${rel.padEnd(28)} gz ${String(gz).padStart(5)} B / ${max} B (${pct}%)`);
  if (gz > max) failures.push(`${rel}: ${gz} B > ${max} B budget`);
}

if (failures.length > 0) {
  console.error("\ncheck-size: bundle budget exceeded:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`\ncheck-size: all ${Object.keys(budgets).length} entries within budget.`);

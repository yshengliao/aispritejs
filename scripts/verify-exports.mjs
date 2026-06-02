#!/usr/bin/env node
// Verify that every entry declared in package.json#exports has a real file in dist/.
// Run after `pnpm build`; fails the publish if entries are missing.

import { readFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

const failures = [];

async function checkTarget(subpath, condition, relPath) {
  const abs = resolve(root, relPath);
  try {
    await access(abs);
  } catch {
    failures.push(`${subpath} → ${condition} → ${relPath} (missing)`);
  }
}

for (const [subpath, target] of Object.entries(pkg.exports)) {
  // A subpath maps either to a conditions object ({ types, import, require })
  // or directly to a file string (e.g. a shipped JSON schema).
  if (typeof target === "string") {
    await checkTarget(subpath, "default", target);
  } else {
    for (const [condition, relPath] of Object.entries(target)) {
      await checkTarget(subpath, condition, relPath);
    }
  }
}

if (failures.length > 0) {
  console.error("verify-exports: missing files declared in package.json#exports:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`verify-exports: all ${Object.keys(pkg.exports).length} subpaths resolved.`);

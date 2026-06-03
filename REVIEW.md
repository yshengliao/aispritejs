# aispritejs Deep Multi-Angle Review

| Field | Value |
|---|---|
| Repo | aispritejs |
| Version | v0.1.1 |
| Branch | claude/adoring-ptolemy-OGonc |
| Head SHA | 4c251139077ef46cb927ed0a8d9f34e26e993c9b |
| Date | 2026-06-03 |
| Reviewer | sonnet (automated deep multi-angle review) |
| Note | NEW / AI-generated project; reviewed across 4 independent angles (A: update-loop, B: atlas input hardening, C: API/docs/schema/llms/types, D: tests and property gaps) |

---

## Verdict / Summary

aispritejs is a well-structured, zero-dependency visual animator with strict TypeScript, deterministic semantics, and a complete CI gate suite. The headline finding from this review is a **HIGH-severity prototype-chain hardening gap** in `compile.ts`: `in`-operator checks accept inherited `Object.prototype` keys (e.g. `"toString"`, `"constructor"`, `"hasOwnProperty"`) as valid state/animation/input names, causing silent misbehavior or later crashes instead of a clean `InvalidGraphError`. This was **applied** (APPLY-1). A second HIGH finding — unclamped `Infinity` in numeric guards — is **deferred** because it requires a deliberate design decision on observable behavior changes. In total **3 safe-fix sets** were applied (prototype hardening, atlas structural validation, doc/type fixes) with **no reverts**; **14 findings** are recorded as deferred follow-ups.

---

## Quality Gate Results

| Gate | Baseline | After Fix | Notes |
|---|---|---|---|
| typecheck | PASS | PASS | strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes |
| lint | FAIL | PASS | Biome formatter: one long line in validation.test.ts split by fix |
| build | PASS | PASS | tsup ESM + CJS + .d.ts |
| verify:exports | PASS | PASS | 4 subpaths resolved |
| verify:llms | PASS | PASS | llms-full.txt regenerated after README edits |
| check:size (index gz) | PASS 3498 B / 3800 B (92%) | PASS 3498 B / 3800 B (92%) | within budget |
| check:size (pixi gz) | PASS 3931 B / 4200 B (94%) | PASS 3931 B / 4200 B (94%) | within budget |
| check:size (atlas gz) | PASS 4191 B / 4400 B (95%) | PASS 4191 B / 4400 B (95%) | within budget |
| coverage (statements) | FAIL 99.43% | PASS 100% | parse.ts lines 109,131 uncovered at baseline |
| coverage (branches) | FAIL 99.10% | PASS 100% | same root cause |
| coverage (functions) | PASS 100% | PASS 100% | |
| coverage (lines) | FAIL 99.37% | PASS 100% | |

**Install**: `pnpm install --frozen-lockfile` succeeded immediately (lockfile up to date). pnpm 9.12.3, Node 22.22.2.

**Baseline note**: lint was failing due to a formatter violation in an already-partially-applied test (long array literal not wrapped), and coverage was failing because the two new `InvalidAtlasError` throw paths in `parse.ts` (APPLY-2) had no covering tests. Both were resolved in this review pass.

---

## Safe Fixes Applied

| File | Kind | Description |
|---|---|---|
| `src/sprite/compile.ts` | Hardening (APPLY-1) | Replace 5 `in`-operator / bracket-access existence checks with `Object.hasOwn` so prototype-key names (`toString`, `constructor`, `hasOwnProperty`, …) are rejected with `InvalidGraphError` instead of silently accepted |
| `test/validation.test.ts` | Tests (APPLY-1) | Add 3 regression tests asserting `InvalidGraphError` for prototype-key `initial`, `animation`, and `input` values; fix biome formatting of long array literal |
| `src/atlas/parse.ts` | Hardening (APPLY-2) | After `frames` isObject check: validate each frame entry is an object (F-3); in atlas-control branch: validate each `transitions` entry is an object (F-5) |
| `test/atlas.test.ts` | Tests (APPLY-2) | Add 2 tests covering the new `InvalidAtlasError` throw paths (F-3: null/string frame entry; F-5: null transition entry) |
| `README.md` | Doc (APPLY-3) | Add `Trigger` to condition-op list in Transitions bullet; update Status to v0.1.1 with SLSA/OIDC note and CHANGELOG link |
| `README_ZHTW.md` | Doc (APPLY-3) | Same changes in Traditional Chinese mirror |
| `llms.txt` | Doc (APPLY-3) | Update CHANGELOG reference to mention v0.1.1 (SLSA provenance) alongside v0.1.0 |
| `llms-full.txt` | Regenerated | `pnpm build:llms` regenerated after README edits; `verify:llms` confirmed up-to-date |
| `ROADMAP.md` | Doc (APPLY-3) | Replace stale internal name `RiveSpriteStateMachine` with `SpriteAnimator` (returned by `createSpriteAnimator`) |
| `src/sprite/types.ts` | Doc (APPLY-3) | Add `@remarks` to `onStateChange` and `onComplete` JSDoc documenting the post-`dispose()` no-op behavior |

**Reverts**: none.

---

## Findings

### 5A — Update-Loop (Angle A)

**[HIGH] Infinity accepted in numeric guards — `compile.ts` and `machine.ts`**
- File:line: `src/sprite/compile.ts:64,70,92`; `src/sprite/machine.ts:106`
- Evidence: `!(x > 0)` guards accept `Infinity` for `defaultFrameDuration`, per-frame `duration`, and state `speed`. `update(Infinity)` is unclamped. Effect: a looping state gets `elapsed = Infinity`, `t = NaN`, snaps permanently to frame 0; `dt = 0` with `speed = Infinity` gives `NaN` permanently; a non-looping state instantly "completes".
- Recommendation: Reject at compile time via `Number.isFinite(x) && x > 0`; and/or clamp `dt` in `update` via `Number.isFinite(dt) ? Math.max(0, dt) : 0`. Concrete patch for compile.ts guard (example, `defaultFrameDuration`): `if (graph.defaultFrameDuration !== undefined && !(Number.isFinite(graph.defaultFrameDuration) && graph.defaultFrameDuration > 0))`.
- Status: **deferred** — changes the set of accepted inputs and thrown-error behavior for currently-valid calls; requires a deliberate design decision.

**[LOW] Unbounded `elapsed` accumulation for permanently-looping states**
- File:line: `src/sprite/machine.ts` (update loop, elapsed accumulation)
- Evidence: Looping states accumulate `elapsed` monotonically; after very long sessions (hours at 60 fps) float precision degrades near `Number.MAX_SAFE_INTEGER`. Practically negligible for typical use.
- Recommendation: On loop wrap, apply `elapsed %= totalDuration` to keep the value small.
- Status: **deferred** — numeric-contract change; low practical impact.

### 5B — Atlas Input Hardening (Angle B)

**[HIGH] frames:{x:null} causes TypeError downstream — `parse.ts` (F-3)**
- File:line: `src/atlas/parse.ts:~109`
- Evidence: Without a per-entry type guard, `frames: { i0: null }` passes the outer `isObject(frames)` check and reaches the core as a `FrameTiming` where `null.duration` throws a plain `TypeError`, not `InvalidAtlasError`.
- Recommendation: Applied — validate each frame entry is an object and throw `InvalidAtlasError`.
- Status: **applied** (APPLY-2).

**[HIGH] transitions:[null] causes TypeError downstream — `parse.ts` (F-5)**
- File:line: `src/atlas/parse.ts:~131`
- Evidence: `transitions: [null]` in the atlas-control branch passes `Array.isArray` and reaches the core, where condition-checking crashes with a plain TypeError.
- Recommendation: Applied — validate each transitions entry is an object and throw `InvalidAtlasError`.
- Status: **applied** (APPLY-2).

**[M] Empty animation list / empty-string frame key caught at wrong layer**
- File:line: `src/sprite/compile.ts:87`; `src/atlas/parse.ts`
- Evidence: An empty animation array (`animations: { idle: [] }`) is caught at compile time as `InvalidGraphError`. Moving the check to the parse layer would change the thrown error type (`InvalidAtlasError` instead of `InvalidGraphError`), breaking existing tests that expect the core error.
- Recommendation: Document the layering contract explicitly: the atlas parser validates structural shape; the compiler validates semantic correctness (empty animation lists, unknown targets). No code change needed; add a comment.
- Status: **deferred** — changing thrown error type would break existing test contracts.

**[L] Schema `animations` lacks `minProperties:1`; numeric guards don't exclude `Infinity`**
- File:line: `schemas/aispritejs-graph.schema.json`
- Evidence: The JSON Schema does not enforce `minProperties:1` on `animations` nor use `exclusiveMinimum:0` in a way that excludes `Infinity` (JSON Schema's `exclusiveMinimum` does exclude Infinity when the value is a finite number, but `duration` and `defaultFrameDuration` constraints would benefit from an explicit `maximum` or documentation note).
- Recommendation: Add `"minProperties": 1` to the `animations` property schema. Consider adding `"maximum": 1e15` or similar to numeric duration fields as a belt-and-suspenders guard.
- Status: **deferred** — schema artifact change; no runtime impact.

**[L] `isForeignStates` array-`definitions` edge case → wrong error message**
- File:line: `src/atlas/parse.ts:67-68` (`isForeignStates`)
- Evidence: If `states` has a string `initial` but `definitions` is an array (not an object), `isForeignStates` returns false, the code falls through to the "no aispritejs control block" error, which is technically accurate but not specific about why the foreign detection failed.
- Recommendation: This is cosmetic only (not a security issue). No action required unless improved diagnostics are desired.
- Status: **deferred** — low priority, cosmetic.

### 5C — API / Docs / Schema / llms / Types (Angle C)

**[M] `Trigger` missing from condition-op list in Transitions mental-model bullet**
- File:line: `README.md:30`, `README_ZHTW.md:30`
- Evidence: The bullet listed `Equals / NotEquals / GreaterThan / LessThan` but omitted `Trigger`, which is a valid and documented op (tested, implemented, and described in the Errors and Semantics sections).
- Recommendation: Applied — added `Trigger` to both READMEs.
- Status: **applied** (APPLY-3).

**[M] Status section shows `v0.1.0` instead of `v0.1.1`**
- File:line: `README.md:203`, `README_ZHTW.md:201`
- Evidence: The package.json and CHANGELOG already reflect v0.1.1; the Status section was stale.
- Recommendation: Applied — updated both READMEs to v0.1.1 with SLSA/OIDC note and CHANGELOG link.
- Status: **applied** (APPLY-3).

**[L] `llms.txt` CHANGELOG reference mentioned only 0.1.0**
- File:line: `llms.txt:15`
- Evidence: The CHANGELOG entry for 0.1.1 (SLSA provenance) was not referenced.
- Recommendation: Applied — updated reference to mention both 0.1.1 and 0.1.0.
- Status: **applied** (APPLY-3).

**[L] Stale internal name `RiveSpriteStateMachine` in ROADMAP.md**
- File:line: `ROADMAP.md:33`
- Evidence: Early working name survived into the shipped roadmap; the public name is `SpriteAnimator` returned by `createSpriteAnimator`.
- Recommendation: Applied — replaced with `SpriteAnimator` (returned by `createSpriteAnimator`).
- Status: **applied** (APPLY-3).

**[L] `onStateChange` / `onComplete` post-`dispose()` behavior undocumented in JSDoc**
- File:line: `src/sprite/types.ts:258,260`
- Evidence: The behavior (no-op unsubscribe, no listener registered) is tested but not documented in the public interface JSDoc.
- Recommendation: Applied — added `@remarks` lines to both methods.
- Status: **applied** (APPLY-3).

### 5D — Tests and Property Gaps (Angle D)

**[M] PBT determinism only covers `platformer()` fixture**
- File:line: `test/property.test.ts`
- Evidence: The `fast-check` determinism property exercises only the platformer graph (idle/walk/jump). The `clips()` fixture and `onEnd` auto-transition are not covered by a property test.
- Recommendation: Add PBT properties for: (a) `clips()` graph determinism; (b) `onEnd` chain determinism; (c) `activeFrameIndex ∈ [0, n-1]` (modulo formula — would catch the Infinity snap-to-0 bug in 5A); (d) `onComplete` fires exactly once across arbitrary `dt` partitions.
- Status: **deferred** — findings-only follow-up.

**[M] No property for `activeFrameIndex ∈ [0, n-1]`**
- File:line: `test/property.test.ts`
- Evidence: There is no property asserting `activeFrameIndex` stays in `[0, frameCount-1]` for arbitrary `dt`. Such a property would directly catch the Infinity snap-to-0 regression described in 5A.
- Recommendation: Add a property using `fc.nat()` for `dt` (or bounded `fc.float`) asserting `anim.activeFrameIndex >= 0 && anim.activeFrameIndex < frames.length`.
- Status: **deferred** — findings-only follow-up.

**[L] `grounded`/`isGrounded` command is a no-op in the PBT fixture**
- File:line: `test/property.test.ts` (platformer fixture)
- Evidence: The property test model tracks `grounded` state but the fixture does not exercise `isGrounded` as a transition condition (the command sets input but no transition fires on it). The model divergence is harmless but wastes model complexity.
- Recommendation: Either wire a transition on `isGrounded` in the fixture or remove the `grounded` model state.
- Status: **deferred** — findings-only follow-up.

**[L] `emitter` abort-before-fire with `{ once, signal }` combination untested**
- File:line: `test/emitter.test.ts`
- Evidence: The `{ once: true, signal }` combination where the signal is aborted before the event fires has no dedicated test. It is a valid edge case (abort wins; listener never registers for the "once" callback).
- Recommendation: Add a test: create an `AbortController`, subscribe with `{ once: true, signal }`, abort before firing, fire the event, assert the handler was never called.
- Status: **deferred** — findings-only follow-up.

**[L] `NotEquals`-variant validation branches untested in isolation**
- File:line: `test/validation.test.ts`
- Evidence: `NotEquals` on a trigger input and `NotEquals` without a value for a number/boolean input are not explicitly tested (the `Equals` variants are covered). The compile-time guard for `NotEquals` mirrors `Equals` logic.
- Recommendation: Add two tests mirroring the existing `Equals` rejection cases for `NotEquals`.
- Status: **deferred** — findings-only follow-up.

**[L] `atlas.initial` / `defaultFrameDuration` wrong-type silently discarded**
- File:line: `src/atlas/parse.ts:140-144`
- Evidence: If `atlas.initial` is a number (not a string), the conditional spread silently omits it. Similarly for `defaultFrameDuration`. No error is thrown; the caller receives a graph with `initial: undefined` where they may have intended a specific initial state.
- Recommendation: Add type-mismatch warnings or throw `InvalidAtlasError` for `atlas.initial` being present but not a string (and same for `defaultFrameDuration` not being a number).
- Status: **deferred** — behavior change; parsing contract decision.

**[L] Self-`onEnd` and non-looping → non-looping `onEnd` chain untested**
- File:line: `test/machine.test.ts`
- Evidence: A state with `onEnd: <own name>` (self-referential `onEnd`) and a multi-hop `onEnd` chain (A → B → C, all non-looping) have no test coverage.
- Recommendation: Add tests for: (a) `onEnd` pointing to its own state (should be caught by the loop+onEnd guard or execute one cycle); (b) A → B → C `onEnd` chain verifying C becomes the active state after advancing past A and B's total durations.
- Status: **deferred** — findings-only follow-up.

---

## Findings-Only Backlog (DO-NOT-APPLY Items)

These items are real quality issues but were excluded from safe-fix scope because they change observable behavior, thrown-error types for currently-accepted input, or require a design decision.

### [HIGH] Infinity numeric corruption in update loop

**Root cause**: `!(x > 0)` accepts `Infinity` at compile.ts:64 (`defaultFrameDuration`), :70 (frame `duration`), :92 (`speed`); `update(Infinity)` is unclamped in machine.ts.

**Symptoms**:
- `speed = Infinity`, `dt = 0` → `elapsed = NaN` → permanent frame 0.
- `update(Infinity)` → `elapsed = Infinity` → looping states snap to frame 0 every frame.
- Non-looping states with any finite duration: one `update(Infinity)` "completes" instantly.

**Recommended patch (compile.ts)**:
```ts
// Replace !(x > 0) guards with:
if (!Number.isFinite(graph.defaultFrameDuration) || graph.defaultFrameDuration <= 0) { ... }
// Same for frame duration and state speed.
```

**Recommended patch (machine.ts, update)**:
```ts
const safeDt = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
```

**Decision required**: Whether to throw `InvalidGraphError` for `Infinity` (breaking change for callers who currently pass it) or silently clamp (non-breaking). Recommend throwing, with a semver-minor bump.

### [LOW] Unbounded `elapsed` float drift

Apply `elapsed %= totalDuration` on each loop wrap in machine.ts. Non-breaking but requires confirming no snapshot tests depend on monotonically increasing `elapsed` (none currently exist).

### [M] PBT property backlog (all findings-only)

Recommended new properties for `test/property.test.ts`:
1. `clips()` and `onEnd` determinism property (mirrors the existing platformer property).
2. `activeFrameIndex ∈ [0, n-1]` for arbitrary bounded `dt` — would catch the Infinity snap-to-0.
3. `onComplete` fires exactly once: for any `dt` partition summing past the total duration, the handler fires exactly once (not zero, not twice).
4. Fix or remove the `grounded` no-op command in the platformer model.

### [L] Schema artifact gaps

In `schemas/aispritejs-graph.schema.json`:
- Add `"minProperties": 1` to the `animations` object.
- Consider adding `"maximum": 1e15` to `duration` / `defaultFrameDuration` / `speed` to express "not Infinity" in schema terms (JSON Schema's numeric bounds do exclude IEEE Infinity when finite bounds are specified).

### [L] Test coverage for untested branches

- `NotEquals` rejection tests (mirror Equals tests in validation.test.ts).
- `{ once: true, signal }` abort-before-fire in emitter.test.ts.
- Self-`onEnd` state and multi-hop `onEnd` chain in machine.test.ts.
- `atlas.initial` / `defaultFrameDuration` wrong-type-discarded case in atlas.test.ts.

---

## Appendix — Commands Run

```
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck          # baseline: PASS
pnpm lint               # baseline: FAIL (formatter)
pnpm build              # baseline: PASS
pnpm verify:exports     # baseline: PASS
pnpm verify:llms        # baseline: PASS
pnpm check:size         # baseline: PASS (3498/3931/4191 B)
pnpm coverage           # baseline: FAIL (99.43%/99.10%/100%/99.37%)
# --- applied fixes ---
pnpm lint               # after: PASS
pnpm coverage           # after: PASS (100/100/100/100)
pnpm build:llms         # regenerate llms-full.txt after README edits
pnpm typecheck          # after: PASS
pnpm build              # after: PASS
pnpm check:size         # after: PASS (3498/3931/4191 B — unchanged)
pnpm verify:exports     # after: PASS
pnpm verify:llms        # after: PASS
pnpm coverage           # after: PASS (100/100/100/100)
```

**Versions**: pnpm 9.12.3 (corepack, pinned in packageManager), Node.js v22.22.2.

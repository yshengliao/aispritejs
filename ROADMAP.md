# aispritejs — Roadmap

> Input-driven, renderer-agnostic 2D sprite animation runtime. Part of the ai\*js family (zero cross-package deps, framework-agnostic core, AI-readable docs). This roadmap phases the build; the public API freezes at 1.0.0.

## Design invariants (hold at every version)

- **Renderer-agnostic core** — the `aispritejs` root entry never imports `pixi.js`, the DOM, or any canvas API.
- **Zero cross-package imports (P0)** — never import `aifsmjs` / `aieventjs` / `aiplaybook` / any sibling; ship an own minimal typed emitter.
- **Zero runtime dependencies in core** — `pixi.js` is an *optional* `peerDependency` for the `/pixi` subpath only (mirrors `aiaudiojs` ↔ `howler`).
- **Visual animator, not a game-logic FSM** — input-driven (Number / Boolean / Trigger), not event-driven.
- **Deterministic `update(dt)`** — identical inputs + identical Δt sequence ⇒ identical frames.
- **Domain-neutral API** — no game nouns (`player`, `level`, `score`, …) in the public surface; `idle`/`walk`/`jump` only ever appear as examples.
- **Family CI gates** — strict TS (no `any`), typecheck → lint → coverage (≥95/90/100/100) → build → verify:exports → check:size; OIDC publish + SLSA provenance.

## Non-goals

- Not a game-logic state machine — that is `aifsmjs`.
- Not a renderer, asset loader, or sprite generator — that is the art pipeline.
- No skeletal / bone animation — sprite-frame (atlas) based only.

## Phases

### v0.1.0 — renderer-agnostic core
- **Inputs**: `Number` / `Boolean` / `Trigger` (trigger auto-resets when a transition consumes it).
- **`State`**: animation key + loop / on-end behaviour + optional speed multiplier.
- **`TransitionCondition`** (operators `Equals` / `NotEquals` / `GreaterThan` / `LessThan`) + **`Transition`** (incl. **Any State**); deterministic priority resolution.
- **`RiveSpriteStateMachine`**: `setInput` / `fireTrigger` / `update(dt)` → active state + active frame index; typed `onStateChange` / `onComplete` emitters.
- Pure TS, zero deps. vitest behavioural tests + optional `fast-check` PBT (transition determinism, trigger consumption). `check:size` budget.

### v0.2.0 — PixiJS v8 adapter (`aispritejs/pixi`)
- `PixiSpriteAnimator` binds a `PIXI.Sprite` / `PIXI.AnimatedSprite`; `update(dt)` swaps the texture to the active frame.
- Honours per-frame `duration` (FrameObject timing) and the atlas `anchor` (no hard-coded `0.5` — respect non-centre pivots).
- `pixi.js` as optional `peerDependency`; core untouched.

### v0.3.0 — atlas / config parser + JSON Schema
- Parse PixiJS-native `frames` + `animations` (consume the family pipeline's atlas output) plus the `aispritejs` `inputs` / `states` / `transitions` block.
- Ship a JSON Schema for the input-driven graph; validate at load (fail-fast).
- Tolerantly ignore any foreign event-driven `states` block in the same file.

### v0.4.0 — family hygiene + stability
- Align to the family dependency-reduction + 1.0-track stability freeze: `STABILITY.md`, `CHANGELOG.md`, `llms.txt` / `llms-full.txt`, `README_ZHTW.md`.
- Per-subpath gzip size budgets; coverage at the family floor.

### v0.5.0+ — ecosystem
- Validated by the family's demo work (parameter-driven character animation); join the unified version line.

### v1.0.0 — freeze
- Freeze the public API + publish benchmarks; no new control model without a major bump.

## Differentiators

- **vs Rive** — same `Number`/`Boolean`/`Trigger` input model, but sprite-sheet/atlas based, tiny, TS-native, no wasm runtime.
- **vs aifsmjs** — visual (input-driven) vs logic (event-driven); complementary, never coupled.
- **vs raw `AnimatedSprite`** — adds parameter-driven transitions, `onStateChange` / `onComplete`, and honours per-frame duration + anchor automatically.

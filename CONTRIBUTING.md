# Contributing to aispritejs

Thanks for helping improve `aispritejs` — the input-driven, renderer-agnostic
sprite animation runtime in the **ai\*js** family.

## Quick start

```bash
pnpm install
pnpm test                 # vitest, run once
pnpm coverage             # with thresholds
pnpm typecheck            # tsc --noEmit (strict)
pnpm lint                 # biome check src test
pnpm build                # tsup → ESM + CJS + .d.ts
pnpm example:platformer   # runnable Node demo
```

The full pre-publish gate (also run in CI) is:

```bash
pnpm typecheck && pnpm lint && pnpm coverage && pnpm build \
  && pnpm verify:exports && pnpm verify:llms && pnpm check:size
```

If you edit any of `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, or
`examples/README.md`, regenerate the bundled LLM context and commit it:

```bash
pnpm build:llms   # writes llms-full.txt; verify:llms fails CI if it drifts
```

## What gets in easily

- Bug fixes with a regression test.
- More renderer adapters behind their own subpath (each importing its renderer
  as an **optional** `peerDependency`, never from the core).
- Docs, examples, and test coverage.

## What needs discussion first

- Any change to the **public API** (the `createSpriteAnimator` surface or the
  graph data format) — open an issue. The API freezes at 1.0.0.
- A new control model or operator — the input-driven model (Number / Boolean /
  Trigger) is deliberate; see the Rive comparison in the README.

## Design principles (non-negotiable)

- **Renderer-agnostic core.** `src/index.ts` and everything it imports must not
  touch `pixi.js`, the DOM, or any canvas API. Only adapter subpaths may.
- **Zero cross-package imports.** Never import `aifsmjs`, `aieventjs`,
  `aiplaybook`, or any sibling. Ship your own minimal code.
- **Input-driven, not event-driven.** This is a *visual* animator, not a
  game-logic FSM (that is `aifsmjs`). Make no assumption about the logic layer.
- **Deterministic & allocation-free.** Identical input + `dt` sequences must
  produce identical frames; the no-transition `update` path allocates nothing.
- **Fail-fast.** Validate graphs and inputs eagerly with named errors.
- **`createX` factories, never bare constructors.** `dispose()` is idempotent;
  subscriptions return an unsubscribe and accept `{ signal, once }`.
- **Domain-neutral surface.** No game nouns (`player`, `score`, …) in the public
  API; `idle` / `walk` / `jump` only as examples.

## Commit & PR style

- Conventional-commit subjects (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- End commit messages with a `Co-Authored-By:` trailer for the model that wrote
  them.
- Keep PRs focused; update `CHANGELOG.md` under `[Unreleased]`.
- Do not bump the version or push tags in a PR — releases are cut by the
  maintainer (the publish workflow runs on tag-push via OIDC).

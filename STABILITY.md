# Stability

This document defines the stability tier of every public symbol exported by
`aispritejs`. Tiers govern what breaks may occur in future minor / major bumps.
The public API freezes at 1.0.0.

## Stable (since 0.1.0)

Fully stable. Breaking changes only at a major version bump (1.0+).

- **Factory** — `createSpriteAnimator(graph)`.
- **`SpriteAnimator` methods** — `setInput`, `fireTrigger`, `update`, `reset`,
  `dispose`, `onStateChange`, `onComplete`.
- **`SpriteAnimator` accessors** — `activeState`, `activeFrameKey`,
  `activeFrameIndex`, `disposed`.
- **Error classes** — `InvalidGraphError`, `UnknownInputError`,
  `InputTypeError`, `SpriteAnimatorDisposedError`.
- **Types** — `SpriteGraph`, `InputDef` (`NumberInputDef` / `BooleanInputDef` /
  `TriggerInputDef`), `StateDef`, `TransitionDef`, `TransitionCondition`,
  `ConditionOp`, `FrameTiming`, `StateChangeHandler`, `CompleteHandler`,
  `ListenerOptions`, `Unsubscribe`.
- **`aispritejs/pixi`** — `createPixiSpriteAnimator(sprite, graph, textures,
  options?)` binding the core to a PixiJS v8 `Sprite`, honouring per-frame
  `duration` and the atlas `anchor` (`texture.defaultAnchor`).
  `MissingTextureError`, `PixiSpriteAnimator`, `PixiSpriteAnimatorOptions`,
  `TextureMap`. `pixi.js` is an **optional**, type-only `peerDependency`,
  imported only by this subpath.
- **`aispritejs/atlas`** — `parseAtlas(atlas, control?)`,
  `loadAtlas(atlas, control?)`, `InvalidAtlasError`, `SpriteControl`. Consumes a
  PixiJS-v8 atlas, ignores any foreign event-driven `states` block, and fails
  fast. JSON Schema shipped at `schemas/aispritejs-graph.schema.json` (exported
  as `aispritejs/schema`). Pure, zero-dependency.

### Behavioural contract (stable)

These semantics are part of the stable surface and are pinned by tests:

- `update(dt)` order: advance `dt × speed` (negative clamps to `0`) → evaluate
  transitions → compute frame → `onComplete` then `onEnd`.
- Transition resolution: `priority` desc, then declared order; first *effective*
  transition wins. A self-targeting transition is effective only if it consumes
  a Trigger.
- Triggers persist until consumed; one fire causes at most one transition.
- Non-looping clips hold the last frame and fire `onComplete` exactly once;
  looping clips wrap and never complete.
- `defaultFrameDuration` is `100` ms; `speed` defaults to `1`.
- Determinism: identical input + `dt` sequences ⇒ identical frame sequences.

## Experimental

None as of 0.1.0.

## Draft (planned, not implemented)

All roadmap modules (1–4) are implemented. No draft APIs outstanding; the next
milestone is the 1.0.0 public-API freeze.

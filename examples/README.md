# Examples

Runnable, renderer-free demonstrations of the `aispritejs` core. Each runs in
plain Node via `tsx` — no canvas, no PixiJS — and logs the active state and
frame key as inputs drive the visual state machine.

## 01 — platformer inputs

```bash
pnpm example:platformer
```

[`01-platformer-inputs/index.ts`](01-platformer-inputs/index.ts) wires a
classic `idle` / `walk` / `jump` graph and exercises every core idea:

- a **Number** input (`speed`) drives `idle ⇄ walk`;
- a **Trigger** (`jump`) fires an **Any-State** transition that beats `walk` by
  `priority`, is consumed on use, and is one-shot;
- a **Boolean** (`isGrounded`) is set alongside, showing inputs are independent
  of the transitions that read them;
- `jump` is non-looping with `onEnd: "idle"`, so the clip auto-returns to
  `idle` and fires `onComplete`;
- `onStateChange` / `onComplete` subscriptions log the transitions;
- `update(dt)` advances per-frame timing; `dispose()` tears down.

The same `graph` object would drive a PixiJS sprite unchanged via the
`aispritejs/pixi` adapter — the core never knows a renderer exists.

## 02 — explosion (PixiJS v8 adapter)

```bash
pnpm example:explosion
```

[`02-explosion-pixi/index.ts`](02-explosion-pixi/index.ts) is the most-common
entry: a **6-frame explosion sprite sheet** (net-splash / hit FX) bound through
the real `aispritejs/pixi` adapter:

- the atlas `animations` block lists the six frame keys, with per-frame `frames`
  durations (a snappy ~40 ms/frame burst);
- a **Trigger** (`detonate`) fires an Any-State transition into a **non-looping**
  `boom` state that **plays once** and auto-returns to a resting `idle` frame via
  `onEnd`;
- `createPixiSpriteAnimator(sprite, graph, textures)` binds a real `PIXI.Sprite`;
  each `update(dt)` swaps `sprite.texture` to the active frame and applies that
  frame's atlas `defaultAnchor`;
- it runs headlessly in Node — the adapter only touches `sprite.texture` /
  `sprite.anchor` / `texture.defaultAnchor`, so plain `PIXI.Texture` / `Sprite`
  instances exercise the real API (no GPU or canvas needed).

This is the play-once FX shape to reach for when you have input-driven,
multi-state visual switching backed by a texture atlas.

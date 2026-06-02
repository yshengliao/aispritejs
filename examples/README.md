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

import { describe, expect, it, vi } from "vitest";
import { type SpriteAnimator, createSpriteAnimator } from "../src/index.js";
import { platformer } from "./fixtures/graphs.js";

// Toggle idle⇄walk to emit a state change on demand.
function toWalk(a: SpriteAnimator): void {
  a.setInput("speed", 1);
  a.update(0);
}
function toIdle(a: SpriteAnimator): void {
  a.setInput("speed", 0);
  a.update(0);
}

describe("onStateChange", () => {
  it("notifies every listener with (to, from)", () => {
    const a = createSpriteAnimator(platformer());
    const one = vi.fn();
    const two = vi.fn();
    a.onStateChange(one);
    a.onStateChange(two);
    toWalk(a);
    expect(one).toHaveBeenCalledWith("walk", "idle");
    expect(two).toHaveBeenCalledWith("walk", "idle");
  });

  it("stops notifying after unsubscribe", () => {
    const a = createSpriteAnimator(platformer());
    const fn = vi.fn();
    const unsub = a.onStateChange(fn);
    unsub();
    toWalk(a);
    expect(fn).not.toHaveBeenCalled();
  });

  it("honours { once } — fires a single time across many changes", () => {
    const a = createSpriteAnimator(platformer());
    const fn = vi.fn();
    a.onStateChange(fn, { once: true });
    toWalk(a);
    toIdle(a);
    toWalk(a);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("removes the listener when its { signal } aborts", () => {
    const a = createSpriteAnimator(platformer());
    const fn = vi.fn();
    const ctrl = new AbortController();
    a.onStateChange(fn, { signal: ctrl.signal });
    toWalk(a);
    expect(fn).toHaveBeenCalledTimes(1);
    ctrl.abort();
    toIdle(a);
    toWalk(a);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("never attaches a listener for an already-aborted signal", () => {
    const a = createSpriteAnimator(platformer());
    const fn = vi.fn();
    const unsub = a.onStateChange(fn, { signal: AbortSignal.abort() });
    toWalk(a);
    expect(fn).not.toHaveBeenCalled();
    expect(unsub).toBeTypeOf("function");
    unsub();
  });

  it("cleans up the abort listener for a { once, signal } handler", () => {
    const a = createSpriteAnimator(platformer());
    const fn = vi.fn();
    const ctrl = new AbortController();
    a.onStateChange(fn, { once: true, signal: ctrl.signal });
    toWalk(a); // fires once, cleanup detaches the abort listener
    expect(fn).toHaveBeenCalledTimes(1);
    expect(() => ctrl.abort()).not.toThrow(); // detached cleanly
    toIdle(a);
    toWalk(a);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("onComplete", () => {
  it("supports { once } and unsubscribe", () => {
    const a = createSpriteAnimator({
      animations: { attack: ["a0"] },
      frames: { a0: { duration: 100 } },
      inputs: { go: { type: "trigger" } },
      states: { attack: { animation: "attack", loop: false }, idle: { animation: "attack" } },
      transitions: [{ from: "attack", to: "idle", when: [{ input: "go", op: "Trigger" }] }],
      initial: "attack",
    });
    const fn = vi.fn();
    const unsub = a.onComplete(fn, { once: true });
    a.update(100); // completes
    expect(fn).toHaveBeenCalledExactlyOnceWith("attack");
    unsub(); // no throw after a once-handler already cleaned up
  });
});

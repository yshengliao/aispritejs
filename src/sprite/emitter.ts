// aispritejs — a tiny single-payload typed signal. This is the package's OWN
// emitter; it deliberately does NOT import `aieventjs` or any sibling (P0
// zero-cross-package rule). Two instances back `onStateChange` and
// `onComplete`.

import type { ListenerOptions, Unsubscribe } from "./types.js";

/**
 * A typed fan-out of one payload `P`. `emit` is allocation-free in the common
 * case; it snapshots listeners only when there is at least one, so a handler
 * that unsubscribes (or a `once` handler) cannot corrupt the in-flight
 * iteration.
 */
export interface Signal<P> {
  on(handler: (payload: P) => void, options?: ListenerOptions): Unsubscribe;
  emit(payload: P): void;
  /** Drop every listener (used by `dispose`). */
  clear(): void;
}

export function createSignal<P>(): Signal<P> {
  const listeners = new Set<(payload: P) => void>();

  function on(handler: (payload: P) => void, options?: ListenerOptions): Unsubscribe {
    // An already-aborted signal means the listener is dead on arrival.
    if (options?.signal?.aborted) return () => {};

    let detachAbort: (() => void) | undefined;
    // One teardown shared by the unsubscribe return, the once-wrapper, and the
    // abort handler, so every path also detaches the abort listener — a `once`
    // handler that passed a `{ signal }` must not leave the abort listener
    // attached after it fires.
    const cleanup: Unsubscribe = () => {
      listeners.delete(wrapped);
      if (detachAbort) {
        detachAbort();
        detachAbort = undefined;
      }
    };

    let wrapped: (payload: P) => void = handler;
    if (options?.once) {
      wrapped = (payload) => {
        cleanup();
        handler(payload);
      };
    }
    listeners.add(wrapped);

    const sig = options?.signal;
    if (sig) {
      const onAbort = () => cleanup();
      sig.addEventListener("abort", onAbort, { once: true });
      detachAbort = () => sig.removeEventListener("abort", onAbort);
    }

    return cleanup;
  }

  function emit(payload: P): void {
    if (listeners.size === 0) return;
    // Snapshot so a handler that unsubscribes (including the once-wrapper)
    // during dispatch does not perturb this pass.
    for (const fn of [...listeners]) fn(payload);
  }

  function clear(): void {
    listeners.clear();
  }

  return { on, emit, clear };
}

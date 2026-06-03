// Shared test graphs. Domain-neutral game examples (idle/walk/jump) used only
// to exercise the input-driven engine — never part of the public API.

import type { SpriteGraph } from "../../src/index.js";

/**
 * Platformer-style graph: a Number (`speed`), a Boolean (`isGrounded`), and a
 * Trigger (`jump`). Exercises priority, Any-State, and trigger consumption.
 * `jump` loops so it never auto-completes — keeps transition tests isolated
 * from end-of-clip behaviour.
 *
 * `isGrounded` is load-bearing: the `jump → idle` landing transition fires
 * when `isGrounded` becomes `false` (mid-air) is no longer the case — i.e.
 * `isGrounded === false` means in-air, transition to idle on landing
 * (`isGrounded === false` triggers the exit). This keeps all existing tests
 * unchanged because they rely on the default `isGrounded = true` (default
 * never satisfies the `isGrounded === false` condition).
 */
export function platformer(): SpriteGraph {
  return {
    animations: {
      idle: ["idle_0", "idle_1"],
      walk: ["walk_0", "walk_1", "walk_2", "walk_3"],
      jump: ["jump_0", "jump_1"],
    },
    frames: {
      idle_0: { duration: 200 },
      idle_1: { duration: 200 },
      walk_0: { duration: 100 },
      walk_1: { duration: 100 },
      walk_2: { duration: 100 },
      walk_3: { duration: 100 },
      jump_0: { duration: 100 },
      jump_1: { duration: 100 },
    },
    inputs: {
      speed: { type: "number", default: 0 },
      isGrounded: { type: "boolean", default: true },
      jump: { type: "trigger" },
    },
    states: {
      idle: { animation: "idle", loop: true },
      walk: { animation: "walk", loop: true },
      jump: { animation: "jump", loop: true },
    },
    transitions: [
      { from: "*", to: "jump", when: [{ input: "jump", op: "Trigger" }], priority: 10 },
      // Land/fall transition: exit jump when isGrounded becomes false (in-air → landed).
      // Default isGrounded=true means this condition never fires in existing tests.
      { from: "jump", to: "idle", when: [{ input: "isGrounded", op: "Equals", value: false }] },
      { from: "idle", to: "walk", when: [{ input: "speed", op: "GreaterThan", value: 0 }] },
      { from: "walk", to: "idle", when: [{ input: "speed", op: "Equals", value: 0 }] },
    ],
    initial: "idle",
  };
}

/**
 * Frame-timing graph: a non-looping `attack` (each frame 100 ms) that auto-
 * returns to a looping `idle` via `onEnd`, plus a looping `run` at double speed.
 * `go` (boolean) drives idle→run.
 */
export function clips(): SpriteGraph {
  return {
    animations: {
      idle: ["idle_0"],
      attack: ["atk_0", "atk_1", "atk_2"],
      run: ["run_0", "run_1"],
    },
    frames: {
      idle_0: { duration: 100 },
      atk_0: { duration: 100 },
      atk_1: { duration: 100 },
      atk_2: { duration: 100 },
      // run_* deliberately omit duration → default 100 ms applies.
    },
    inputs: {
      go: { type: "boolean", default: false },
      attack: { type: "trigger" },
    },
    states: {
      idle: { animation: "idle", loop: true },
      attack: { animation: "attack", loop: false, onEnd: "idle" },
      run: { animation: "run", loop: true, speed: 2 },
    },
    transitions: [
      { from: "*", to: "attack", when: [{ input: "attack", op: "Trigger" }], priority: 10 },
      { from: "idle", to: "run", when: [{ input: "go", op: "Equals", value: true }] },
      { from: "run", to: "idle", when: [{ input: "go", op: "Equals", value: false }] },
    ],
    initial: "idle",
    defaultFrameDuration: 100,
  };
}

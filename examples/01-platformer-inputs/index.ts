// Example 01 — input-driven platformer animation, no renderer. Run with:
//   pnpm example:platformer
//
// Demonstrates the full loop: set inputs → the graph picks a visual state →
// update(dt) ticks the active frame → read activeFrameKey. The state machine
// is renderer-agnostic, so this runs in plain Node and just logs frame keys.

import { createSpriteAnimator, type SpriteGraph } from "../../src/index.js";

const graph: SpriteGraph = {
  // PixiJS-v8-native atlas blocks (only frame keys + durations matter to core).
  animations: {
    idle: ["idle_0", "idle_1"],
    walk: ["walk_0", "walk_1", "walk_2", "walk_3"],
    jump: ["jump_0", "jump_1", "jump_2"],
  },
  frames: {
    idle_0: { duration: 250 },
    idle_1: { duration: 250 },
    walk_0: { duration: 80 },
    walk_1: { duration: 80 },
    walk_2: { duration: 80 },
    walk_3: { duration: 80 },
    jump_0: { duration: 120 },
    jump_1: { duration: 120 },
    jump_2: { duration: 120 },
  },
  // aispritejs control block — input-driven, not event-driven.
  inputs: {
    speed: { type: "number", default: 0 },
    isGrounded: { type: "boolean", default: true },
    jump: { type: "trigger" },
  },
  states: {
    idle: { animation: "idle", loop: true },
    walk: { animation: "walk", loop: true },
    jump: { animation: "jump", loop: false, onEnd: "idle" }, // land back to idle
  },
  transitions: [
    { from: "*", to: "jump", when: [{ input: "jump", op: "Trigger" }], priority: 10 },
    { from: "idle", to: "walk", when: [{ input: "speed", op: "GreaterThan", value: 0 }] },
    { from: "walk", to: "idle", when: [{ input: "speed", op: "Equals", value: 0 }] },
  ],
  initial: "idle",
};

const anim = createSpriteAnimator(graph);

anim.onStateChange((to, from) => console.log(`  state: ${from} → ${to}`));
anim.onComplete((state) => console.log(`  complete: ${state}`));

function tick(label: string, dt: number): void {
  anim.update(dt);
  console.log(`${label.padEnd(22)} dt=${String(dt).padStart(3)}  ${anim.activeState}/${anim.activeFrameKey}`);
}

console.log("start:", anim.activeState, anim.activeFrameKey);

console.log("\n# accelerate → walk");
anim.setInput("speed", 6);
tick("update", 0);
tick("update", 80);
tick("update", 80);

console.log("\n# jump (one-shot trigger, beats walk by priority)");
anim.setInput("isGrounded", false);
anim.fireTrigger("jump");
tick("update", 0);
tick("update", 120);
tick("update", 120);
tick("update", 120); // jump clip ends → onEnd returns to idle

console.log("\n# decelerate → idle");
anim.setInput("speed", 0);
anim.setInput("isGrounded", true);
tick("update", 0);

anim.dispose();
console.log("\ndisposed:", anim.disposed);

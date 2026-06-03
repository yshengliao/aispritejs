import { describe, expect, it } from "vitest";
import { InvalidGraphError, type SpriteGraph, createSpriteAnimator } from "../src/index.js";

// Build a minimal valid graph, then override one field per case to isolate the
// failure. Malformed-shape cases (bad operator / input type) use a cast since
// the type system would otherwise reject them at author time.
function base(): SpriteGraph {
  return {
    animations: { idle: ["i0"] },
    inputs: { n: { type: "number" }, b: { type: "boolean" }, t: { type: "trigger" } },
    states: { idle: { animation: "idle" } },
    transitions: [],
    initial: "idle",
  };
}

const expectInvalid = (graph: unknown) =>
  expect(() => createSpriteAnimator(graph as SpriteGraph)).toThrow(InvalidGraphError);

describe("graph validation", () => {
  it("rejects an empty states block", () => {
    expectInvalid({ ...base(), states: {} });
  });

  it("rejects an unknown input type", () => {
    expectInvalid({ ...base(), inputs: { bad: { type: "color" } } });
  });

  it("rejects a non-positive defaultFrameDuration", () => {
    expectInvalid({ ...base(), defaultFrameDuration: 0 });
  });

  it("rejects a non-positive frame duration", () => {
    expectInvalid({ ...base(), frames: { i0: { duration: -5 } } });
  });

  it("rejects an unknown initial state", () => {
    expectInvalid({ ...base(), initial: "ghost" });
  });

  it("rejects a state referencing an unknown animation", () => {
    expectInvalid({ ...base(), states: { idle: { animation: "missing" } } });
  });

  it("rejects an empty animation frame list", () => {
    expectInvalid({ ...base(), animations: { idle: [] } });
  });

  it("rejects a non-positive state speed", () => {
    expectInvalid({ ...base(), states: { idle: { animation: "idle", speed: 0 } } });
  });

  it("rejects onEnd combined with loop:true", () => {
    expectInvalid({
      ...base(),
      states: { idle: { animation: "idle", loop: true, onEnd: "idle" } },
    });
  });

  it("rejects an onEnd target that is not declared", () => {
    expectInvalid({
      ...base(),
      states: { idle: { animation: "idle", loop: false, onEnd: "ghost" } },
    });
  });

  it("rejects a transition from an unknown state", () => {
    expectInvalid({ ...base(), transitions: [{ from: "ghost", to: "idle" }] });
  });

  it("rejects a transition to an unknown state", () => {
    expectInvalid({ ...base(), transitions: [{ from: "idle", to: "ghost" }] });
  });

  it("rejects a condition on an unknown input", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "ghost", op: "Trigger" }] }],
    });
  });

  it("rejects a Trigger op on a non-trigger input", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "n", op: "Trigger" }] }],
    });
  });

  it("rejects a Trigger condition carrying a value", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "t", op: "Trigger", value: 1 }] }],
    });
  });

  it("rejects GreaterThan / LessThan on a non-number input", () => {
    expectInvalid({
      ...base(),
      transitions: [
        { from: "idle", to: "idle", when: [{ input: "b", op: "GreaterThan", value: 1 }] },
      ],
    });
  });

  it("rejects GreaterThan without a numeric value", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "n", op: "GreaterThan" }] }],
    });
  });

  it("rejects Equals / NotEquals on a trigger input", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "t", op: "Equals", value: 1 }] }],
    });
  });

  it("rejects Equals on a number input without a numeric value", () => {
    expectInvalid({
      ...base(),
      transitions: [
        { from: "idle", to: "idle", when: [{ input: "n", op: "Equals", value: true }] },
      ],
    });
  });

  it("rejects Equals on a boolean input without a boolean value", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "b", op: "Equals", value: 1 }] }],
    });
  });

  it("rejects an unknown operator", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: [{ input: "n", op: "Between", value: 1 }] }],
    });
  });

  it("rejects a null transition entry (direct compileGraph hardening)", () => {
    expectInvalid({
      ...base(),
      transitions: [null as unknown as { from: string; to: string }],
    });
    expect(() =>
      createSpriteAnimator({
        ...base(),
        transitions: [null as unknown as { from: string; to: string }],
      }),
    ).toThrow(new InvalidGraphError("transition #0 must be an object"));
  });

  it("rejects a non-array `when` on a transition (direct compileGraph hardening)", () => {
    expectInvalid({
      ...base(),
      transitions: [{ from: "idle", to: "idle", when: {} as unknown as never[] }],
    });
    expect(() =>
      createSpriteAnimator({
        ...base(),
        transitions: [{ from: "idle", to: "idle", when: {} as unknown as never[] }],
      }),
    ).toThrow(new InvalidGraphError(`transition #0 "when" must be an array`));
  });

  it("accepts a valid graph with all operator kinds", () => {
    expect(() =>
      createSpriteAnimator({
        ...base(),
        transitions: [
          { from: "idle", to: "idle", when: [{ input: "n", op: "GreaterThan", value: 1 }] },
          { from: "idle", to: "idle", when: [{ input: "b", op: "NotEquals", value: false }] },
          { from: "*", to: "idle", when: [{ input: "t", op: "Trigger" }] },
        ],
      }),
    ).not.toThrow();
  });

  // Prototype-key hardening: Object.prototype names must never be accepted as
  // valid state, animation, or input references — they are not own properties.
  it("rejects a prototype-key initial state (Object.hasOwn hardening)", () => {
    expectInvalid({ ...base(), initial: "toString" });
  });

  it("rejects a state referencing a prototype-key animation (Object.hasOwn hardening)", () => {
    expectInvalid({
      ...base(),
      states: { idle: { animation: "constructor" } },
    });
  });

  it("rejects a transition condition on a prototype-key input name (Object.hasOwn hardening)", () => {
    expectInvalid({
      ...base(),
      transitions: [
        { from: "idle", to: "idle", when: [{ input: "hasOwnProperty", op: "Trigger" }] },
      ],
    });
  });
});

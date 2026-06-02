import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  InvalidAtlasError,
  type SpriteControl,
  loadAtlas,
  parseAtlas,
} from "../src/atlas/index.js";
import { InvalidGraphError, type SpriteGraph } from "../src/index.js";

// The real PixiJS-v8 atlas emitted by the family sprite pipeline. It carries a
// FOREIGN event-driven `states` block ({ initial, definitions } keyed by events
// like MOVE_DOWN / ATTACK) that aispritejs must ignore.
const reimuAtlas = JSON.parse(
  readFileSync(new URL("./fixtures/reimu-atlas.json", import.meta.url), "utf8"),
) as { animations: Record<string, string[]>; states: { definitions: unknown } };

// An input-driven control to drive the real atlas's frames/animations.
const reimuControl: SpriteControl = {
  inputs: {
    moving: { type: "boolean", default: false },
    attack: { type: "trigger" },
  },
  states: {
    idle_front: { animation: "idle_front", loop: true },
    walk_front: { animation: "walk_front", loop: true },
    attack_front: { animation: "attack_front", loop: false, onEnd: "idle_front" },
  },
  transitions: [
    { from: "*", to: "attack_front", when: [{ input: "attack", op: "Trigger" }], priority: 10 },
    {
      from: "idle_front",
      to: "walk_front",
      when: [{ input: "moving", op: "Equals", value: true }],
    },
    {
      from: "walk_front",
      to: "idle_front",
      when: [{ input: "moving", op: "Equals", value: false }],
    },
  ],
  initial: "idle_front",
};

// A self-contained augmented atlas (README "Data format" shape).
function augmentedAtlas(): Record<string, unknown> {
  return {
    meta: { image: "sheet.png" },
    animations: { idle: ["idle_0", "idle_1"], walk: ["walk_0"] },
    frames: { idle_0: { duration: 120 }, idle_1: { duration: 120 }, walk_0: { duration: 80 } },
    inputs: { speed: { type: "number", default: 0 } },
    states: { idle: { animation: "idle", loop: true }, walk: { animation: "walk", loop: true } },
    transitions: [
      { from: "idle", to: "walk", when: [{ input: "speed", op: "GreaterThan", value: 0 }] },
    ],
    initial: "idle",
    defaultFrameDuration: 100,
  };
}

describe("parseAtlas — augmented atlas (no control)", () => {
  it("reads inputs/states/transitions and frame timing from the atlas itself", () => {
    const graph = parseAtlas(augmentedAtlas());
    expect(Object.keys(graph.animations)).toEqual(["idle", "walk"]);
    expect(graph.frames?.idle_0?.duration).toBe(120);
    expect(graph.initial).toBe("idle");
    expect(graph.defaultFrameDuration).toBe(100);
    expect(graph.transitions).toHaveLength(1);
  });

  it("loads into a working animator", () => {
    const a = loadAtlas(augmentedAtlas());
    expect(a.activeState).toBe("idle");
    a.setInput("speed", 3);
    a.update(0);
    expect(a.activeState).toBe("walk");
  });

  it("omits initial/defaultFrameDuration/frames when the atlas omits them", () => {
    const graph = parseAtlas({
      animations: { idle: ["idle_0"] },
      inputs: {},
      states: { idle: { animation: "idle" } },
      transitions: [],
    });
    expect(graph.initial).toBeUndefined();
    expect(graph.defaultFrameDuration).toBeUndefined();
    expect(graph.frames).toBeUndefined();
  });
});

describe("parseAtlas — real PixiJS atlas + control (ignores foreign states)", () => {
  it("uses the supplied control, not the atlas's event-driven states", () => {
    const graph = parseAtlas(reimuAtlas, reimuControl);
    // animations/frames come from the atlas...
    expect(graph.animations.idle_front).toEqual(reimuAtlas.animations.idle_front);
    expect(graph.frames).toBeDefined();
    // ...but the input-driven graph is the control, NOT the foreign block.
    expect(graph.transitions).toBe(reimuControl.transitions);
    expect(graph.states).toBe(reimuControl.states);
  });

  it("drives real frames through input transitions and onEnd, honouring atlas durations", () => {
    const a = loadAtlas(reimuAtlas, reimuControl);
    const anims = reimuAtlas.animations;
    expect(a.activeState).toBe("idle_front");
    expect(a.activeFrameKey).toBe(anims.idle_front[0]);

    a.setInput("moving", true);
    a.update(0);
    expect(a.activeState).toBe("walk_front");
    expect(anims.walk_front).toContain(a.activeFrameKey);

    a.fireTrigger("attack");
    a.update(0);
    expect(a.activeState).toBe("attack_front");
    expect(a.activeFrameKey).toBe(anims.attack_front[0]);

    // attack_front is non-looping; real frames are 100 ms each → advance past
    // its total to complete and auto-return to idle_front via onEnd.
    a.update(anims.attack_front.length * 100 + 1);
    expect(a.activeState).toBe("idle_front");
  });

  it("throws without a control because the atlas's states are event-driven", () => {
    expect(() => parseAtlas(reimuAtlas)).toThrow(InvalidAtlasError);
  });
});

describe("parseAtlas — structural validation", () => {
  it("rejects a non-object atlas", () => {
    expect(() => parseAtlas(null)).toThrow(InvalidAtlasError);
    expect(() => parseAtlas("nope")).toThrow(InvalidAtlasError);
  });

  it("rejects malformed animations", () => {
    expect(() => parseAtlas({ animations: 5 }, reimuControl)).toThrow(InvalidAtlasError);
    expect(() => parseAtlas({ animations: { idle: "x" } }, reimuControl)).toThrow(
      InvalidAtlasError,
    );
    expect(() => parseAtlas({ animations: { idle: [1, 2] } }, reimuControl)).toThrow(
      InvalidAtlasError,
    );
  });

  it("rejects a non-object frames block", () => {
    expect(() => parseAtlas({ animations: { idle: ["i0"] }, frames: 5 }, reimuControl)).toThrow(
      InvalidAtlasError,
    );
  });

  it("throws when there is no aispritejs control block and none supplied", () => {
    expect(() => parseAtlas({ animations: { idle: ["i0"] } })).toThrow(InvalidAtlasError);
  });

  it("treats a non-object `definitions` as not-foreign and still asks for a control", () => {
    // states has a string `initial` but a non-object `definitions` → not the
    // foreign wrapper; with no usable control block it still throws.
    expect(() =>
      parseAtlas({ animations: { idle: ["i0"] }, states: { initial: "idle", definitions: 5 } }),
    ).toThrow(InvalidAtlasError);
  });

  it("parses with a control even when the atlas has no frames", () => {
    const control: SpriteControl = {
      inputs: {},
      states: { idle: { animation: "idle" } },
      transitions: [],
      initial: "idle",
    };
    const graph: SpriteGraph = parseAtlas({ animations: { idle: ["i0"] } }, control);
    expect(graph.frames).toBeUndefined();
    expect(graph.states).toBe(control.states);
  });
});

describe("loadAtlas — semantic validation", () => {
  it("surfaces InvalidGraphError for a semantically invalid graph", () => {
    const control: SpriteControl = {
      inputs: {},
      states: { idle: { animation: "idle" } },
      transitions: [{ from: "idle", to: "ghost" }], // unknown target
      initial: "idle",
    };
    expect(() => loadAtlas({ animations: { idle: ["i0"] } }, control)).toThrow(InvalidGraphError);
  });
});

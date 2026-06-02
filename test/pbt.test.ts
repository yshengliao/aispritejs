import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createSpriteAnimator } from "../src/index.js";
import { clips, platformer } from "./fixtures/graphs.js";

type Cmd =
  | { readonly kind: "speed"; readonly v: number }
  | { readonly kind: "grounded"; readonly b: boolean }
  | { readonly kind: "jump" }
  | { readonly kind: "update"; readonly dt: number };

const command: fc.Arbitrary<Cmd> = fc.oneof(
  fc.integer({ min: -3, max: 10 }).map((v) => ({ kind: "speed", v }) as const),
  fc.boolean().map((b) => ({ kind: "grounded", b }) as const),
  fc.constant({ kind: "jump" } as const),
  fc.integer({ min: 0, max: 300 }).map((dt) => ({ kind: "update", dt }) as const),
);

function trace(cmds: readonly Cmd[]): string[] {
  const a = createSpriteAnimator(platformer());
  const out: string[] = [];
  for (const c of cmds) {
    switch (c.kind) {
      case "speed":
        a.setInput("speed", c.v);
        break;
      case "grounded":
        a.setInput("isGrounded", c.b);
        break;
      case "jump":
        a.fireTrigger("jump");
        break;
      case "update":
        a.update(c.dt);
        break;
    }
    out.push(`${a.activeState}:${a.activeFrameKey}:${a.activeFrameIndex}`);
  }
  return out;
}

describe("property: determinism", () => {
  it("identical command sequences produce identical frame traces", () => {
    fc.assert(
      fc.property(fc.array(command, { maxLength: 50 }), (cmds) => {
        expect(trace(cmds)).toEqual(trace(cmds));
      }),
    );
  });
});

describe("property: trigger consumption", () => {
  it("a single fire enters the trigger state exactly once", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 500 }), { maxLength: 30 }), (dts) => {
        const a = createSpriteAnimator(clips());
        let entries = 0;
        a.onStateChange((to) => {
          if (to === "attack") entries++;
        });
        a.fireTrigger("attack");
        a.update(0);
        for (const dt of dts) a.update(dt);
        // Fired once → entered once; the consumed trigger never re-fires the
        // Any-State transition no matter how time advances afterwards.
        expect(entries).toBe(1);
      }),
    );
  });

  it("a trigger that is never fired never enters its state", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 500 }), { maxLength: 30 }), (dts) => {
        const a = createSpriteAnimator(clips());
        for (const dt of dts) a.update(dt);
        expect(a.activeState).toBe("idle");
      }),
    );
  });
});

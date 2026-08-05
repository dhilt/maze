import assert from "node:assert/strict";
import test from "node:test";

import { createFloor, FLOOR_STYLES, isFloorStyle } from "../src/rendering/floors/index.js";

const options = { worldWidth: 640, worldHeight: 448, seed: 1 };

test("registered floor themes are recognized and implement the draw contract", () => {
  assert.ok(FLOOR_STYLES.length > 0);
  assert.ok(FLOOR_STYLES.includes("stone"), "the fallback theme must be registered");
  for (const style of FLOOR_STYLES) {
    assert.equal(isFloorStyle(style), true);
    const floor = createFloor(style, options);
    assert.equal(typeof floor.draw, "function", `${style} is missing draw()`);
  }
  assert.equal(isFloorStyle("unknown"), false);
});

test("unknown themes safely return a drawable fallback", () => {
  const floor = createFloor("unknown", options);
  assert.equal(typeof floor.draw, "function");
});

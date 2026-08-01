import assert from "node:assert/strict";
import test from "node:test";

import { createFloor, FLOOR_STYLES, isFloorStyle } from "../src/rendering/floors/index.js";

const options = { worldWidth: 640, worldHeight: 448, seed: 1 };

test("floor registry exposes the installed themes", () => {
  assert.deepEqual(FLOOR_STYLES, ["stone", "crypt"]);
  assert.equal(isFloorStyle("stone"), true);
  assert.equal(isFloorStyle("crypt"), true);
  assert.equal(isFloorStyle("unknown"), false);
});

test("every floor theme implements the draw contract", () => {
  for (const style of FLOOR_STYLES) {
    const floor = createFloor(style, options);
    assert.equal(typeof floor.draw, "function", `${style} is missing draw()`);
  }
});

test("unknown themes safely fall back to stone", () => {
  const floor = createFloor("unknown", options);
  assert.equal(typeof floor.draw, "function");
});

import assert from "node:assert/strict";
import test from "node:test";

import { generateWorld } from "../src/world/world.js";

test("cells expose independent serialisable object containers", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const left = world.at(0, 0);
  const right = world.at(1, 0);

  assert.deepEqual(left.objects, []);
  assert.deepEqual(right.objects, []);
  assert.notEqual(left.objects, right.objects);

  left.objects.push({ id: "bones-1", kind: "bones", layer: "background" });
  assert.equal(left.objects.length, 1);
  assert.equal(right.objects.length, 0);
  assert.doesNotThrow(() => JSON.stringify(world.cells));
});

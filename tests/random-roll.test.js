import assert from "node:assert/strict";
import test from "node:test";

import { createBoundedNormalRoll } from "../src/game/random-roll.js";
import { createRandom } from "../src/world/random.js";

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test("bounded normal rolls are deterministic and remain normalized", () => {
  const first = createBoundedNormalRoll({ random: createRandom(42) });
  const second = createBoundedNormalRoll({ random: createRandom(42) });
  const firstValues = Array.from({ length: 2000 }, first);
  const secondValues = Array.from({ length: 2000 }, second);

  assert.deepEqual(firstValues, secondValues);
  assert.ok(firstValues.every((value) => value >= 0 && value <= 1));
  assert.ok(mean(firstValues) > 0.47 && mean(firstValues) < 0.53);
});

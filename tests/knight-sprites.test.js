import assert from "node:assert/strict";
import test from "node:test";

import { selectAttackFrame } from "../src/rendering/character/knight-sprites.js";

test("the attack reaches its contact frame quickly and holds it", () => {
  assert.equal(selectAttackFrame(0.00), 0);
  assert.equal(selectAttackFrame(0.31), 3);
  assert.equal(selectAttackFrame(0.32), 4);
  assert.equal(selectAttackFrame(0.67), 4);
  assert.equal(selectAttackFrame(0.68), 5);
  assert.equal(selectAttackFrame(1.00), 8);
});

test("attack frame selection clamps invalid progress and supports other counts", () => {
  assert.equal(selectAttackFrame(-1), 0);
  assert.equal(selectAttackFrame(Number.NaN), 0);
  assert.equal(selectAttackFrame(1), 8);
  assert.equal(selectAttackFrame(0.5, 7), 3);
});

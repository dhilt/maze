import assert from "node:assert/strict";
import test from "node:test";

import {
  selectAttackFrame,
  selectConsumeFrame,
} from "../src/rendering/character/knight-sprites.js";

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

test("consume distributes its frames uniformly across the action", () => {
  assert.equal(selectConsumeFrame(0.00), 0);
  assert.equal(selectConsumeFrame(0.12), 0);
  assert.equal(selectConsumeFrame(0.125), 1);
  assert.equal(selectConsumeFrame(0.25), 2);
  assert.equal(selectConsumeFrame(0.375), 3);
  assert.equal(selectConsumeFrame(0.50), 4);
  assert.equal(selectConsumeFrame(0.625), 5);
  assert.equal(selectConsumeFrame(0.75), 6);
  assert.equal(selectConsumeFrame(0.875), 7);
});

test("consume frame selection clamps progress and supports other counts", () => {
  assert.equal(selectConsumeFrame(-1), 0);
  assert.equal(selectConsumeFrame(Number.NaN), 0);
  assert.equal(selectConsumeFrame(1), 7);
  assert.equal(selectConsumeFrame(0.5, 4), 2);
});

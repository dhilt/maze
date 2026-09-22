import assert from "node:assert/strict";
import test from "node:test";

import {
  getKnightAttackOffset,
  selectAttackFrame,
  selectConsumeFrame,
} from "../src/rendering/character/knight-sprites.js";

test("the downward attack advances with the step, holds contact and returns to rest", () => {
  const expected = [0, 0, 1, 3, 5, 6, 6, 3, 0, 0];
  for (const [frame, y] of expected.entries()) {
    assert.deepEqual(getKnightAttackOffset("down", frame), { x: 0, y });
  }
  assert.deepEqual(getKnightAttackOffset("down", selectAttackFrame(0.38)), { x: 0, y: 6 });
  assert.deepEqual(getKnightAttackOffset("down", selectAttackFrame(0.53)), { x: 0, y: 6 });
  assert.deepEqual(getKnightAttackOffset("down", selectAttackFrame(1)), { x: 0, y: 0 });
});

test("every attack direction reaches its own facing edge and returns to rest", () => {
  const peaks = {
    down: { x: 0, y: 6 },
    up: { x: 0, y: -14 },
    left: { x: -10, y: 0 },
    right: { x: 10, y: 0 },
  };
  for (const [direction, peak] of Object.entries(peaks)) {
    assert.deepEqual(getKnightAttackOffset(direction, 0), { x: 0, y: 0 });
    assert.deepEqual(getKnightAttackOffset(direction, 5), peak);
    assert.deepEqual(getKnightAttackOffset(direction, 6), peak);
    assert.deepEqual(getKnightAttackOffset(direction, 9), { x: 0, y: 0 });
  }
});

test("attack travel scales with the cell and keeps whole-pixel offsets", () => {
  assert.deepEqual(getKnightAttackOffset("down", 5, 128), { x: 0, y: 12 });
  assert.deepEqual(getKnightAttackOffset("down", 5, 48), { x: 0, y: 5 });
  assert.deepEqual(getKnightAttackOffset("left", 5, 48), { x: -8, y: 0 });
  assert.deepEqual(getKnightAttackOffset("right", 5, 48), { x: 8, y: 0 });
  assert.deepEqual(getKnightAttackOffset("down", -1), { x: 0, y: 0 });
  assert.deepEqual(getKnightAttackOffset("down", 10), { x: 0, y: 0 });
});

test("attack timing preserves every phase of the approved ten-frame clips", () => {
  const durations = [150, 70, 60, 50, 50, 160, 70, 70, 110, 220];
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  let elapsed = 0;
  for (const [frame, duration] of durations.entries()) {
    assert.equal(selectAttackFrame((elapsed + 0.01) / total), frame);
    assert.equal(selectAttackFrame((elapsed + duration / 2) / total), frame);
    assert.equal(selectAttackFrame((elapsed + duration - 0.01) / total), frame);
    elapsed += duration;
  }
});

test("attack holds the contact pose across the middle of the action", () => {
  assert.equal(selectAttackFrame(0.37), 4);
  assert.equal(selectAttackFrame(0.38), 5);
  assert.equal(selectAttackFrame(0.50), 5);
  assert.equal(selectAttackFrame(0.53), 5);
  assert.equal(selectAttackFrame(0.54), 6);
});

test("attack frame selection clamps invalid progress and supports other counts", () => {
  assert.equal(selectAttackFrame(-1), 0);
  assert.equal(selectAttackFrame(Number.NaN), 0);
  assert.equal(selectAttackFrame(1), 9);
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

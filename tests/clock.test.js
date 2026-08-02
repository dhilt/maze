import assert from "node:assert/strict";
import test from "node:test";

import { createClock } from "../src/game/clock.js";

const near = (a, b) => Math.abs(a - b) < 1e-9;

test("first tick has zero delta and starts time at zero", () => {
  const clock = createClock();
  const first = clock.tick(1000);
  assert.equal(first.dt, 0);
  assert.equal(first.time, 0);
});

test("delta is elapsed seconds and time accumulates", () => {
  const clock = createClock();
  clock.tick(1000);
  const b = clock.tick(1050); // +50ms
  assert.ok(near(b.dt, 0.05));
  assert.ok(near(b.time, 0.05));
  const c = clock.tick(1070); // +20ms
  assert.ok(near(c.dt, 0.02));
  assert.ok(near(c.time, 0.07));
});

test("delta is clamped to maxDelta on long gaps", () => {
  const clock = createClock({ maxDelta: 0.1 });
  clock.tick(1000);
  const b = clock.tick(5000); // 4s gap → clamped
  assert.equal(b.dt, 0.1);
  assert.ok(near(b.time, 0.1));
});

test("negative gaps (clock skew) never produce negative delta", () => {
  const clock = createClock();
  clock.tick(1000);
  const b = clock.tick(900); // time went backwards
  assert.equal(b.dt, 0);
});

test("reset avoids a huge delta after a pause", () => {
  const clock = createClock({ maxDelta: 0.1 });
  clock.tick(1000);
  clock.reset(9000); // resumed much later
  const b = clock.tick(9016); // ~16ms after resume
  assert.ok(near(b.dt, 0.016));
});

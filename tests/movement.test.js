import assert from "node:assert/strict";
import test from "node:test";

import { createMovement } from "../src/game/movement.js";

const step = (dx, dy, dir, duration = 0.5) => ({ kind: "step", dx, dy, duration, facing: dir });
const turn = (dir) => ({ kind: "turn", dx: 0, dy: 0, duration: 0, facing: dir });

test("a step faces its direction and moves one cell when it lands", () => {
  const player = { col: 2, row: 2 };
  const movement = createMovement({ player, cellSize: 64 });

  movement.begin(step(1, 0, "right"));
  assert.equal(movement.facing, "right");
  assert.equal(movement.active, true);

  assert.equal(movement.update(0.3), 0); // still crossing
  assert.deepEqual(player, { col: 2, row: 2 });
  movement.update(0.2); // 0.5 total → lands
  assert.equal(movement.active, false);
  assert.deepEqual(player, { col: 3, row: 2 });
});

test("a turn is instant, changes only facing, moves nothing", () => {
  const player = { col: 2, row: 2 };
  const movement = createMovement({ player, cellSize: 64 });

  movement.begin(turn("up"));
  const leftover = movement.update(0.1); // duration 0 → completes at once
  assert.equal(movement.active, false);
  assert.equal(movement.facing, "up");
  assert.deepEqual(player, { col: 2, row: 2 });
  assert.equal(movement.move, null);
  assert.ok(Math.abs(leftover - 0.1) < 1e-9); // all the time carries over
});

test("getPixelPosition interpolates a step in progress", () => {
  const player = { col: 1, row: 1 };
  const movement = createMovement({ player, cellSize: 64 });

  movement.begin(step(1, 0, "right"));
  movement.update(0.25); // half of 0.5
  const pos = movement.getPixelPosition();
  assert.ok(Math.abs(pos.x - (1 * 64 + 0.5 * 64)) < 1e-6);
  assert.ok(Math.abs(pos.y - 1 * 64) < 1e-6);
});

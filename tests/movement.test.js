import assert from "node:assert/strict";
import test from "node:test";

import { createMovement } from "../src/game/movement.js";

const step = (dx, dy, dir, timeCost = 5) => ({ kind: "step", dx, dy, timeCost, facing: dir });
const turn = (dir) => ({ kind: "turn", dx: 0, dy: 0, timeCost: 1, facing: dir });

test("a step faces its direction and moves one cell when it lands", () => {
  const player = { col: 2, row: 2, facing: "down" };
  const movement = createMovement({ player, cellSize: 64 });

  movement.begin(step(1, 0, "right"));
  assert.equal(movement.facing, "right");
  assert.equal(movement.active, true);

  assert.equal(movement.update(3), 0); // still crossing
  assert.deepEqual(player, { col: 2, row: 2, facing: "right" });
  movement.update(2); // 5 units total → lands
  assert.equal(movement.active, false);
  assert.deepEqual(player, { col: 3, row: 2, facing: "right" });
});

test("a turn costs one unit, changes only facing, moves nothing", () => {
  const player = { col: 2, row: 2, facing: "down" };
  const movement = createMovement({ player, cellSize: 64 });

  movement.begin(turn("up"));
  assert.equal(movement.update(0.4), 0);
  assert.equal(movement.active, true);
  const leftover = movement.update(0.7); // 1.1 total → 0.1 carries over
  assert.equal(movement.active, false);
  assert.equal(movement.facing, "up");
  assert.deepEqual(player, { col: 2, row: 2, facing: "up" });
  assert.equal(movement.move, null);
  assert.ok(Math.abs(leftover - 0.1) < 1e-9);
});

test("getPixelPosition interpolates a step in progress", () => {
  const player = { col: 1, row: 1, facing: "down" };
  const movement = createMovement({ player, cellSize: 64 });

  movement.begin(step(1, 0, "right"));
  movement.update(2.5); // half of 5 units
  const pos = movement.getPixelPosition();
  assert.ok(Math.abs(pos.x - (1 * 64 + 0.5 * 64)) < 1e-6);
  assert.ok(Math.abs(pos.y - 1 * 64) < 1e-6);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createMovement } from "../src/game/movement.js";
import { generateWorld } from "../src/world/world.js";

function makeMovement(world, player, actionTime = 0.5) {
  return createMovement({ world, player, cellSize: 64, actionTime });
}

test("a clear direction steps one cell and faces it", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const player = { col: 2, row: 2 };
  const movement = makeMovement(world, player);

  movement.start("right");
  assert.equal(movement.facing, "right");
  assert.equal(movement.move.dx, 1);
  assert.equal(movement.active, true);

  movement.update(0.3);
  assert.equal(movement.active, true); // still crossing
  movement.update(0.2); // 0.5 total → completes
  assert.equal(movement.active, false);
  assert.deepEqual(player, { col: 3, row: 2 });
});

test("a blocked direction is an in-place turn/bump, not a step", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = true;
  const player = { col: 2, row: 2 };
  const movement = makeMovement(world, player);

  movement.start("right");
  assert.equal(movement.move, null); // no step
  assert.equal(movement.active, true); // but busy for one action
  assert.equal(movement.facing, "right"); // faces the wall

  movement.update(0.5);
  assert.equal(movement.active, false);
  assert.deepEqual(player, { col: 2, row: 2 }); // did not move
});

test("the world boundary blocks a step (in-place action instead)", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const player = { col: 0, row: 0 };
  const movement = makeMovement(world, player);

  movement.start("up"); // top boundary
  assert.equal(movement.move, null);
  assert.equal(movement.facing, "up");
});

test("update returns leftover time when an action completes", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const player = { col: 2, row: 2 };
  const movement = makeMovement(world, player, 0.5);

  movement.start("right");
  assert.equal(movement.update(0.3), 0); // not done yet
  const leftover = movement.update(0.25); // 0.55 total → 0.05 leftover
  assert.ok(Math.abs(leftover - 0.05) < 1e-9);
});

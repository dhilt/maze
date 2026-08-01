import assert from "node:assert/strict";
import test from "node:test";

import { createMovement } from "../src/game/movement.js";
import { generateWorld } from "../src/world/world.js";

test("movement completes one orthogonal cell and updates facing", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const player = { col: 2, row: 2 };
  const input = { getDirection: () => ({ dx: 1, dy: 0 }) };
  const movement = createMovement({
    world,
    player,
    input,
    cellSize: 64,
    cellTime: 0.44,
  });

  movement.update(0.2);
  assert.equal(movement.facing, "right");
  assert.equal(movement.move.dx, 1);

  movement.update(0.24);
  assert.equal(player.col, 3);
  assert.equal(player.row, 2);
});

test("movement respects a blocking wall", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = true;
  const player = { col: 2, row: 2 };
  const input = { getDirection: () => ({ dx: 1, dy: 0 }) };
  const movement = createMovement({
    world,
    player,
    input,
    cellSize: 64,
    cellTime: 0.44,
  });

  movement.update(1);
  assert.equal(movement.move, null);
  assert.deepEqual(player, { col: 2, row: 2 });
});

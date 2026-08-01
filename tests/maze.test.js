import assert from "node:assert/strict";
import test from "node:test";

import { generateMaze, hasWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

function wallSnapshot(world) {
  return world.cells.map(({ wallRight, wallDown }) => [wallRight, wallDown]);
}

test("maze generation is reproducible for a fixed seed", () => {
  const a = generateWorld({ width: 12, height: 9, seed: 1 });
  const b = generateWorld({ width: 12, height: 9, seed: 1 });
  generateMaze(a, { density: 33, seed: 12345 });
  generateMaze(b, { density: 33, seed: 12345 });
  assert.deepEqual(wallSnapshot(a), wallSnapshot(b));
});

test("maze generation leaves no fully enclosed cells", () => {
  const world = generateWorld({ width: 20, height: 20, seed: 1 });
  generateMaze(world, { density: 80, seed: 9876 });

  for (let row = 0; row < world.height; row++) {
    for (let col = 0; col < world.width; col++) {
      const enclosed =
        hasWall(world, col, row, 0, -1) &&
        hasWall(world, col, row, 0, 1) &&
        hasWall(world, col, row, -1, 0) &&
        hasWall(world, col, row, 1, 0);
      assert.equal(enclosed, false, `cell ${col}/${row} is enclosed`);
    }
  }
});

test("world perimeter is always solid", () => {
  const world = generateWorld({ width: 4, height: 3, seed: 1 });
  assert.equal(hasWall(world, 0, 1, -1, 0), true);
  assert.equal(hasWall(world, 3, 1, 1, 0), true);
  assert.equal(hasWall(world, 2, 0, 0, -1), true);
  assert.equal(hasWall(world, 2, 2, 0, 1), true);
});

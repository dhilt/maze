import assert from "node:assert/strict";
import test from "node:test";

import {
  EXIT_PHASES,
  placeExit,
} from "../src/world/exit.js";
import { generateMaze } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

function exitCoordinates(world) {
  return world.cells
    .filter((cell) => cell.exit !== null)
    .map(({ x, y }) => ({ x, y }));
}

test("places exactly one exit within two cells of the world perimeter", () => {
  const world = generateWorld({ width: 20, height: 20, seed: 1 });
  generateMaze(world, {
    density: 80,
    seed: 9876,
    baseHealth: 20,
    defense: 2,
    impactWear: 1,
  });

  const exit = placeExit(world, { seed: 12345 });

  assert.deepEqual(exitCoordinates(world), [{ x: exit.x, y: exit.y }]);
  assert.equal(
    exit.x <= 2 ||
      exit.y <= 2 ||
      exit.x >= world.width - 3 ||
      exit.y >= world.height - 3,
    true,
  );
});

test("exit placement is reproducible and replaces an earlier marker", () => {
  const first = generateWorld({ width: 12, height: 9, seed: 1 });
  const second = generateWorld({ width: 12, height: 9, seed: 1 });
  const wall = { baseHealth: 20, defense: 2, impactWear: 1 };
  generateMaze(first, { density: 33, seed: 2468, ...wall });
  generateMaze(second, { density: 33, seed: 2468, ...wall });

  placeExit(first, { seed: 1357 });
  placeExit(second, { seed: 1357 });
  assert.deepEqual(exitCoordinates(first), exitCoordinates(second));

  placeExit(first, { seed: 9753 });
  assert.equal(exitCoordinates(first).length, 1);
});

test("a one-cell world uses its only cell as the exit", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  const exit = placeExit(world, { seed: 42 });

  assert.equal(exit, world.at(0, 0));
  assert.deepEqual(world.at(0, 0).exit, {
    kind: "exit",
    phase: EXIT_PHASES.HIDDEN,
    revealStartedAt: null,
    revealDuration: null,
  });
});

test("a hidden exit may occupy the hero's starting cell", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const player = { col: 2, row: 2 };

  const exit = placeExit(world, { seed: 10 });

  assert.deepEqual([exit.x, exit.y], [player.col, player.row]);
  assert.equal(exit.exit.phase, EXIT_PHASES.HIDDEN);
});

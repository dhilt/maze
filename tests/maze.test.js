import assert from "node:assert/strict";
import test from "node:test";

import {
  createWall,
  damageWall,
  generateMaze,
  getWall,
  hasWall,
  INDESTRUCTIBLE_WALL,
} from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

const WALL_PROFILE = Object.freeze({
  baseHealth: 20,
  defense: 2,
  impactWear: 1,
});

function wallSnapshot(world) {
  return world.cells.map(({ wallRight, wallDown }) => [wallRight, wallDown]);
}

test("maze generation requires an explicit wall combat profile", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });

  assert.throws(
    () => generateMaze(world, { density: 30, seed: 12345 }),
    /baseHealth must be a positive number or Infinity/,
  );
  assert.throws(
    () => generateMaze(world, { density: 30, seed: 12345, baseHealth: 20 }),
    /defense must be a non-negative number or Infinity/,
  );
  assert.throws(
    () => generateMaze(world, {
      density: 30,
      seed: 12345,
      baseHealth: 20,
      defense: 2,
    }),
    /impactWear must be a non-negative number/,
  );
});

test("a wall may have zero Defense without losing its combat shape", () => {
  assert.deepEqual(createWall({ health: 10, defense: 0, impactWear: 0.5 }), {
    kind: "wall",
    material: "stone",
    stats: { health: 10, defense: 0 },
    statsMax: { health: 10, defense: 0 },
    impactWear: 0.5,
  });
});

test("maze generation is reproducible for a fixed seed", () => {
  const a = generateWorld({ width: 12, height: 9, seed: 1 });
  const b = generateWorld({ width: 12, height: 9, seed: 1 });
  generateMaze(a, { density: 33, seed: 12345, ...WALL_PROFILE });
  generateMaze(b, { density: 33, seed: 12345, ...WALL_PROFILE });
  assert.deepEqual(wallSnapshot(a), wallSnapshot(b));
});

test("generated walls carry variable health and a stable combat profile", () => {
  const world = generateWorld({ width: 20, height: 20, seed: 1 });
  generateMaze(world, { density: 100, seed: 12345, ...WALL_PROFILE });

  const walls = world.cells
    .flatMap((cell) => [cell.wallRight, cell.wallDown])
    .filter((wall) => wall !== null);
  const values = new Set(walls.map((wall) => wall.stats.health));

  assert.ok(walls.length > 0);
  assert.ok(walls.every((wall) => Number.isInteger(wall.stats.health)));
  assert.ok(walls.every((wall) => wall.stats.health > 0));
  assert.ok(walls.every((wall) => wall.stats.defense === WALL_PROFILE.defense));
  assert.ok(walls.every((wall) => wall.impactWear === WALL_PROFILE.impactWear));
  assert.ok(walls.every((wall) => wall.statsMax.health === wall.stats.health));
  assert.ok(values.size > 1, "wall quality should vary across the generated world");
});

test("Infinity represents indestructible perimeter and special walls", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  world.at(1, 1).wallRight = createWall({
    health: Infinity,
    defense: Infinity,
    impactWear: 1,
  });

  assert.equal(getWall(world, 0, 1, -1, 0), INDESTRUCTIBLE_WALL);
  assert.deepEqual(damageWall(world, 0, 1, -1, 0), {
    hit: true,
    broken: false,
    health: Infinity,
  });
  assert.deepEqual(damageWall(world, 1, 1, 1, 0), {
    hit: true,
    broken: false,
    health: Infinity,
  });
  assert.equal(world.at(1, 1).wallRight.stats.health, Infinity);
});

test("both neighbours resolve and damage the same canonical wall object", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  world.at(1, 1).wallRight = createWall({ health: 2, defense: 2, impactWear: 1 });
  world.at(1, 1).wallDown = createWall({ health: 2, defense: 2, impactWear: 1 });

  assert.equal(getWall(world, 1, 1, 1, 0), getWall(world, 2, 1, -1, 0));
  assert.deepEqual(damageWall(world, 2, 1, -1, 0), {
    hit: true,
    broken: false,
    health: 1,
  });
  assert.equal(world.at(1, 1).wallRight.stats.health, 1);

  assert.deepEqual(damageWall(world, 1, 1, 1, 0), {
    hit: true,
    broken: true,
    health: 0,
  });
  assert.equal(world.at(1, 1).wallRight, null);
  assert.equal(hasWall(world, 2, 1, -1, 0), false);
  const rubble = world.at(1, 1).objects[0];
  assert.deepEqual({
    kind: rubble.kind,
    layer: rubble.layer,
    placement: rubble.placement,
    material: rubble.material,
  }, {
    kind: "wall-rubble",
    layer: "background",
    placement: { type: "edge", edge: "right" },
    material: "stone",
  });
  assert.equal(Number.isInteger(rubble.visualSeed), true);
  assert.deepEqual(world.at(2, 1).objects, [], "rubble stays on the canonical owner cell");

  assert.equal(getWall(world, 1, 1, 0, 1), getWall(world, 1, 2, 0, -1));
  damageWall(world, 1, 2, 0, -1);
  assert.equal(world.at(1, 1).wallDown.stats.health, 1);
  damageWall(world, 1, 2, 0, -1);
  assert.equal(world.at(1, 1).wallDown, null);
  assert.deepEqual(world.at(1, 1).objects[1].placement, { type: "edge", edge: "down" });
});

test("maze generation leaves no fully enclosed cells", () => {
  const world = generateWorld({ width: 20, height: 20, seed: 1 });
  generateMaze(world, { density: 80, seed: 9876, ...WALL_PROFILE });

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

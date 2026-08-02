import assert from "node:assert/strict";
import test from "node:test";

import { drawWalls } from "../src/rendering/walls.js";
import { createWall, damageWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

function recordingContext() {
  const segments = [];
  let start = null;
  return {
    segments,
    beginPath() {},
    save() {},
    restore() {},
    stroke() {},
    moveTo(x, y) { start = [x, y]; },
    lineTo(x, y) { segments.push([start, [x, y]]); },
  };
}

function render(world) {
  const ctx = recordingContext();
  drawWalls(ctx, {
    cam: { px: 0, py: 0 },
    world,
    cellSize: 64,
    viewCols: world.width,
    viewRows: world.height,
    worldCols: world.width,
    worldRows: world.height,
  });
  return ctx.segments;
}

test("a wall object renders until its health reaches zero", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  world.at(0, 0).wallRight = createWall({ health: 1, defense: 2, impactWear: 1 });
  const internalEdge = [[64, 0], [64, 64]];

  assert.ok(render(world).some((segment) => (
    segment[0][0] === internalEdge[0][0] && segment[0][1] === internalEdge[0][1] &&
    segment[1][0] === internalEdge[1][0] && segment[1][1] === internalEdge[1][1]
  )));

  damageWall(world, 0, 0, 1, 0);

  assert.equal(render(world).some((segment) => (
    segment[0][0] === 64 && segment[0][1] === 0 &&
    segment[1][0] === 64 && segment[1][1] === 64
  )), false);
});

test("damage adds deterministic crack stages before a wall disappears", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  world.at(0, 0).wallRight = createWall({ health: 100, defense: 2, impactWear: 1 });
  const intactSegments = render(world).length;

  damageWall(world, 0, 0, 1, 0, 25);
  assert.equal(render(world).length, intactSegments + 3);

  damageWall(world, 0, 0, 1, 0, 25);
  assert.equal(render(world).length, intactSegments + 6);

  damageWall(world, 0, 0, 1, 0, 25);
  assert.equal(render(world).length, intactSegments + 9);

  damageWall(world, 0, 0, 1, 0, 24);
  const critical = render(world);
  assert.equal(critical.length, intactSegments + 12);
  assert.deepEqual(render(world), critical, "cracks must not move between frames");
});

test("horizontal wall cracks are rotated with their edge", () => {
  const world = generateWorld({ width: 1, height: 2, seed: 1 });
  world.at(0, 0).wallDown = createWall({ health: 10, defense: 2, impactWear: 1 });
  damageWall(world, 0, 0, 0, 1, 5);

  const diagonalSegments = render(world).filter(([from, to]) => (
    from[0] !== to[0] && from[1] !== to[1]
  ));
  assert.ok(diagonalSegments.length > 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createCamera } from "../src/game/camera.js";
import { generateWorld } from "../src/world/world.js";

function movementAt(position) {
  return {
    getPixelPosition() { return position; },
  };
}

test("centres a world smaller than the viewport on both axes", () => {
  const cellSize = 64;
  const world = generateWorld({ width: 5, height: 5 });
  const player = { col: 2, row: 2 };
  const camera = createCamera({
    player,
    movement: movementAt({ x: 2 * cellSize, y: 2 * cellSize }),
    world,
    cellSize,
    viewCols: 10,
    viewRows: 7,
    margin: 2,
  });

  assert.deepEqual(camera.state, { px: -160, py: -64 });
  camera.update();
  assert.deepEqual(camera.state, { px: -160, py: -64 });
});

test("centres only the axis that is smaller than the viewport", () => {
  const cellSize = 64;
  const world = generateWorld({ width: 5, height: 20 });
  const player = { col: 2, row: 10 };
  const camera = createCamera({
    player,
    movement: movementAt({ x: 2 * cellSize, y: 10 * cellSize }),
    world,
    cellSize,
    viewCols: 10,
    viewRows: 7,
    margin: 2,
  });

  assert.deepEqual(camera.state, { px: -160, py: 448 });
});

test("uses zero offset when world and viewport dimensions match", () => {
  const world = generateWorld({ width: 10, height: 7 });
  const camera = createCamera({
    player: { col: 5, row: 3 },
    movement: movementAt({ x: 320, y: 192 }),
    world,
    cellSize: 64,
    viewCols: 10,
    viewRows: 7,
    margin: 2,
  });

  assert.deepEqual(camera.state, { px: 0, py: 0 });
});

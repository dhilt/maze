import assert from "node:assert/strict";
import test from "node:test";

import { drawExits } from "../src/rendering/exits.js";
import { generateWorld } from "../src/world/world.js";

function recordingContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    beginPath: record("beginPath"),
    ellipse: record("ellipse"),
    fill: record("fill"),
    stroke: record("stroke"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
  };
}

function drawAt(time) {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  world.at(0, 0).exit = true;
  const ctx = recordingContext();
  drawExits(ctx, {
    cam: { px: 0, py: 0 },
    world,
    cellSize: 64,
    viewCols: 1,
    viewRows: 1,
    time,
  });
  return ctx.calls;
}

test("portal animation is deterministic and changes with game time", () => {
  assert.deepEqual(drawAt(7), drawAt(7));
  assert.notDeepEqual(drawAt(0), drawAt(7));
});

test("cells without an exit do not draw a portal", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  const ctx = recordingContext();

  drawExits(ctx, {
    cam: { px: 0, py: 0 },
    world,
    cellSize: 64,
    viewCols: 1,
    viewRows: 1,
    time: 7,
  });

  assert.deepEqual(ctx.calls, []);
});

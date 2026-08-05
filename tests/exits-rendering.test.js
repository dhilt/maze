import assert from "node:assert/strict";
import test from "node:test";

import { drawExits } from "../src/rendering/exits.js";
import { EXIT_PHASES } from "../src/world/exit.js";
import { generateWorld } from "../src/world/world.js";

function recordingContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  const ctx = {
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
  Object.defineProperty(ctx, "globalAlpha", {
    get: () => 1,
    set: (value) => calls.push(["globalAlpha", value]),
  });
  return ctx;
}

function drawAt(time) {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  world.at(0, 0).exit = { kind: "exit", phase: EXIT_PHASES.OPEN };
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

test("a hidden exit marker does not draw a portal", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  world.at(0, 0).exit = { kind: "exit", phase: EXIT_PHASES.HIDDEN };
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

test("a revealing exit fades in from its combat start time", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  world.at(0, 0).exit = {
    kind: "exit",
    phase: EXIT_PHASES.REVEALING,
    revealStartedAt: 10,
    revealDuration: 5,
  };
  const ctx = recordingContext();

  drawExits(ctx, {
    cam: { px: 0, py: 0 },
    world,
    cellSize: 64,
    viewCols: 1,
    viewRows: 1,
    time: 12.5,
  });

  assert.deepEqual(
    ctx.calls.find(([name]) => name === "globalAlpha"),
    ["globalAlpha", 0.5],
  );
});

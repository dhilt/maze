import assert from "node:assert/strict";
import test from "node:test";

import { createActionAdapter } from "../src/game/actions/adapter.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

const COSTS = { step: 5, turn: 1, attack: 5 };

function makeAdapter(world, player) {
  return createActionAdapter({ world, player, costs: COSTS });
}

test("a clear direction resolves to a step", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "down" });
  const a = adapter.adapt("right");
  assert.equal(a.kind, "step");
  assert.deepEqual([a.dx, a.dy], [1, 0]);
  assert.equal(a.timeCost, 5);
  assert.equal(a.facing, "right");
});

test("a wall transforms a move into a one-unit turn", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "down" });
  const a = adapter.adapt("right");
  assert.equal(a.kind, "turn");
  assert.equal(a.timeCost, 1);
  assert.equal(a.facing, "right"); // still faces the wall
});

test("a blocked move in the current facing is cancelled as a no-op", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "right" });

  assert.equal(adapter.adapt("right"), null);
});

test("the world boundary transforms a move into a one-unit turn", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const adapter = makeAdapter(world, { col: 0, row: 0, facing: "down" });
  const a = adapter.adapt("up");
  assert.equal(a.kind, "turn");
  assert.equal(a.timeCost, 1);
  assert.equal(a.facing, "up");
});

test("attack resolves to an attack action that keeps facing", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "down" });
  const a = adapter.adapt("attack");
  assert.equal(a.kind, "attack");
  assert.equal(a.timeCost, 5);
  assert.equal(a.facing, null);
});

test("attack facing a stored wall resolves to a wall attack", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "right" });

  const a = adapter.adapt("attack");

  assert.equal(a.kind, "wallAttack");
  assert.equal(a.timeCost, 5);
  assert.equal(a.facing, null);
  assert.deepEqual(a.target, { x: 2, y: 2, dx: 1, dy: 0 });
});

test("attack facing the world perimeter resolves against an indestructible wall", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const adapter = makeAdapter(world, { col: 0, row: 1, facing: "left" });

  const a = adapter.adapt("attack");
  assert.equal(a.kind, "wallAttack");
  assert.deepEqual(a.target, { x: 0, y: 1, dx: -1, dy: 0 });
});

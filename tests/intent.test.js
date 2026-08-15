import assert from "node:assert/strict";
import test from "node:test";

import { actorBlocksEntry, resolveIntent } from "../src/game/actions/intent.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

const actor = (facing, extras = {}) => ({
  col: 2,
  row: 2,
  facing,
  actionCosts: { step: 5, turn: 1, attack: 7 },
  ...extras,
});

function resolve(desired, {
  facing = "down",
  world = generateWorld({ width: 5, height: 5, seed: 1 }),
  towardBlocked = true,
  cell,
  ...extras
} = {}) {
  return resolveIntent({
    actor: actor(facing, extras),
    desired,
    world,
    towardBlocked,
    cell,
  });
}

test("the hero turns toward a wall; a beast ignores that side", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });

  const turn = resolve("right", { facing: "down", world, towardBlocked: true });
  assert.equal(turn.kind, "turn");
  assert.equal(turn.facing, "right");
  assert.equal(resolve("right", { facing: "down", world, towardBlocked: false }), null);
  assert.equal(resolve("right", { facing: "right", world }), null);
});

test("a clear aligned direction is a step", () => {
  const step = resolve("right", { facing: "right" });
  assert.equal(step.kind, "step");
  assert.deepEqual([step.dx, step.dy], [1, 0]);
  assert.equal(step.timeCost, 5);
});

test("a faced occupant is an attack; a blocked cell cancels", () => {
  const cell = (col, row) => (col === 3 && row === 2 ? "attack" : null);
  assert.equal(resolve("right", { facing: "down", cell }).kind, "turn");
  assert.deepEqual(resolve("right", { facing: "right", cell }).targetCell, { col: 3, row: 2 });
  assert.equal(resolve("right", { facing: "right", cell: () => "block" }), null);
});

test("actorBlocksEntry reserves a step destination and forbids head-on swaps", () => {
  const walker = { col: 1, row: 0, move: { kind: "step", dx: 1, dy: 0 } };
  assert.equal(actorBlocksEntry(walker, 0, 0, 2, 0), true);
  assert.equal(actorBlocksEntry(walker, 2, 0, 1, 0), true);
  assert.equal(actorBlocksEntry(walker, 0, 0, 1, 0), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createActionAdapter } from "../src/game/actions/adapter.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";
import { createCharacterFixture } from "./fixtures/character.js";

const COSTS = { step: 5, face: 1, attack: 5, eat: 10 };

function makeAdapter(
  world,
  player,
  findEntryBlocker = () => null,
  character,
  findEntityById = () => null,
  onActionRejected,
) {
  return createActionAdapter({
    world,
    player,
    character: character ?? createCharacterFixture({ actionCosts: COSTS }),
    findEntryBlocker,
    findEntityById,
    onActionRejected,
  });
}

test("a clear direction change resolves to a face", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "down" });
  const a = adapter.adapt("right");
  assert.equal(a.kind, "face");
  assert.deepEqual([a.dx, a.dy], [0, 0]);
  assert.equal(a.timeCost, 1);
  assert.equal(a.facing, "right");
});

test("a clear direction matching facing resolves to a step", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "right" });
  const a = adapter.adapt("right");
  assert.equal(a.kind, "step");
  assert.deepEqual([a.dx, a.dy], [1, 0]);
  assert.equal(a.timeCost, 5);
  assert.equal(a.facing, "right");
});

test("actions capture the character's current cost when they resolve", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const character = createCharacterFixture({ actionCosts: { step: 3 } });
  const adapter = makeAdapter(
    world,
    { col: 2, row: 2, facing: "right" },
    undefined,
    character,
  );

  const first = adapter.adapt("right");
  character.actionCosts.step = 7;
  const second = adapter.adapt("right");

  assert.equal(first.timeCost, 3);
  assert.equal(second.timeCost, 7);
});

test("a direction change resolves to a face even when a wall blocks the route", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "down" });
  const a = adapter.adapt("right");
  assert.equal(a.kind, "face");
  assert.equal(a.timeCost, 1);
  assert.equal(a.facing, "right"); // still faces the wall
});

test("a blocked move in the current facing is cancelled as a no-op", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "right" });

  assert.equal(adapter.adapt("right"), null);
});

test("the world boundary transforms a move into a one-unit face", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const adapter = makeAdapter(world, { col: 0, row: 0, facing: "down" });
  const a = adapter.adapt("up");
  assert.equal(a.kind, "face");
  assert.equal(a.timeCost, 1);
  assert.equal(a.facing, "up");
});

test("an occupied cell turns first, then a frontal move becomes an attack", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const player = { col: 1, row: 1, facing: "down" };
  const adapter = makeAdapter(
    world,
    player,
    (_fromCol, _fromRow, col, row) => (
      col === 2 && row === 1 ? { id: "monster-1" } : null
    ),
  );

  const face = adapter.adapt("right");
  assert.equal(face.kind, "face");
  assert.equal(face.facing, "right");

  player.facing = "right";
  const attack = adapter.adapt("right");
  assert.equal(attack.kind, "attack");
  assert.equal(attack.timeCost, COSTS.attack);
  assert.deepEqual(attack.targetCell, { col: 2, row: 1 });
  assert.equal(attack.target, undefined);
});

test("attack resolves to an attack action that keeps facing", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "down" });
  const a = adapter.adapt("attack");
  assert.equal(a.kind, "attack");
  assert.equal(a.timeCost, 5);
  assert.equal(a.facing, null);
  assert.deepEqual(a.targetCell, { col: 2, row: 3 });
});

test("explicit attack targets the facing cell, not its current occupant", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const adapter = makeAdapter(
    world,
    { col: 1, row: 1, facing: "right" },
    (_fromCol, _fromRow, col, row) => (
      col === 2 && row === 1 ? { id: "monster-1" } : null
    ),
  );

  const attack = adapter.adapt("attack");

  assert.equal(attack.target, undefined);
  assert.deepEqual(attack.targetCell, { col: 2, row: 1 });
});

test("attack facing a stored wall resolves to a wall attack", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  world.at(2, 2).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const adapter = makeAdapter(world, { col: 2, row: 2, facing: "right" });

  const a = adapter.adapt("attack");

  assert.equal(a.kind, "attack");
  assert.equal(a.timeCost, 5);
  assert.equal(a.facing, null);
  assert.deepEqual(a.target, { x: 2, y: 2, dx: 1, dy: 0 });
});

test("attack facing the world perimeter resolves against an indestructible wall", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const adapter = makeAdapter(world, { col: 0, row: 1, facing: "left" });

  const a = adapter.adapt("attack");
  assert.equal(a.kind, "attack");
  assert.deepEqual(a.target, { x: 0, y: 1, dx: -1, dy: 0 });
});

test("consume resolves only for an injured hero with enough morale standing on a corpse", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  const player = { col: 0, row: 0, facing: "down" };
  const character = createCharacterFixture({
    stats: { health: 15, morale: 3 },
    actionCosts: COSTS,
  });
  const monster = { id: "m1", carcass: { moraleCost: 3 } };
  const rejections = [];
  const corpse = {
    id: "corpse-m1",
    kind: "corpse",
    layer: "background",
    entityId: "m1",
  };
  world.at(0, 0).objects.push(corpse);
  const adapter = makeAdapter(
    world,
    player,
    undefined,
    character,
    (id) => (id === monster.id ? monster : null),
    (event) => rejections.push(event),
  );

  assert.deepEqual(adapter.adapt("eat"), {
    kind: "eat",
    timeCost: 10,
    target: { col: 0, row: 0, corpseId: "corpse-m1", entityId: "m1" },
  });

  character.stats.morale = 2;
  assert.equal(adapter.adapt("eat"), null);
  assert.deepEqual(rejections, [{ action: "eat", reason: "morale" }]);
  character.stats.morale = 3;
  character.stats.health = character.statsMax.health;
  assert.equal(adapter.adapt("eat"), null);
  character.stats.health = 15;
  world.at(0, 0).objects.length = 0;
  assert.equal(adapter.adapt("eat"), null);
  assert.equal(rejections.length, 1, "other cancellation reasons do not flash Morale");
});

test("consume selects an affordable carcass when several corpses share a cell", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  const player = { col: 0, row: 0, facing: "down" };
  const character = createCharacterFixture({
    stats: { health: 15, morale: 3 },
    actionCosts: COSTS,
  });
  const monsters = [
    { id: "expensive", carcass: { moraleCost: 4 } },
    { id: "affordable", carcass: { moraleCost: 3 } },
  ];
  world.at(0, 0).objects.push(
    { id: "corpse-expensive", kind: "corpse", entityId: "expensive" },
    { id: "corpse-affordable", kind: "corpse", entityId: "affordable" },
  );
  const adapter = makeAdapter(
    world,
    player,
    undefined,
    character,
    (id) => monsters.find((monster) => monster.id === id) ?? null,
  );

  assert.deepEqual(adapter.adapt("eat").target, {
    col: 0,
    row: 0,
    corpseId: "corpse-affordable",
    entityId: "affordable",
  });
});

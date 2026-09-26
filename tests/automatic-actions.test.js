import assert from "node:assert/strict";
import test from "node:test";

import { createAutomaticActions } from "../src/game/actions/automatic-actions.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

function createAutomatic(player, monsters, world = generateWorld({ width: 4, height: 4, seed: 1 })) {
  return createAutomaticActions({ world, player, monsters });
}

test("a front neighbour is engaged, while a side neighbour is ignored until it attacks", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const front = { id: "front", col: 2, row: 1, stats: { health: 10 } };
  const side = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutomatic(player, [front, side]);

  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "front" });
  auto.onAttackStart({ monsterId: "side" });
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "side" });
  player.facing = "up";
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "side" });
});

test("a departed or dead attacker cannot force a stale reaction", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const monster = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  auto.onAttackStart({ monsterId: monster.id });
  monster.col = 3;
  assert.equal(auto.nextIntent(), null);
  monster.col = 1;
  monster.stats.health = 0;
  assert.equal(auto.nextIntent(), null);
});

test("a new manual intent cancels an old reaction but not a later threat", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const monster = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  auto.onAttackStart({ monsterId: monster.id });
  auto.onManualIntent();
  assert.equal(auto.nextIntent(), null);
  auto.onAttackStart({ monsterId: monster.id });
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: monster.id });
});

test("a simultaneous side threat takes precedence over a front threat", () => {
  for (const order of [["front", "side"], ["side", "front"]]) {
    const player = { col: 1, row: 1, facing: "right" };
    const monsters = [
      { id: "front", col: 2, row: 1, stats: { health: 10 } },
      { id: "side", col: 1, row: 0, stats: { health: 10 } },
    ];
    const auto = createAutomatic(player, monsters);
    for (const monsterId of order) auto.onAttackStart({ monsterId });
    assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "side" });
  }
});

test("a moving monster is selected by its occupied cell, not its reservation", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const monster = {
    id: "moving",
    col: 3,
    row: 1,
    stats: { health: 10 },
    move: { kind: "step", dx: -1, dy: 0, elapsed: 1, timeCost: 10 },
  };
  const auto = createAutomatic(player, [monster]);

  assert.equal(auto.nextIntent(), null);
  monster.col = 2;
  monster.move = null;
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: monster.id });
});

test("a completed manual face takes one step direction before automatic combat when threatened", () => {
  const player = { col: 1, row: 1, facing: "down" };
  const monster = { id: "front", col: 1, row: 2, facing: "up", stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  assert.equal(auto.nextIntent({ afterManualFace: "down" }), "down");
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: monster.id });
});

test("a completed manual face checks the live threat, not the state at key press", () => {
  const player = { col: 1, row: 1, facing: "up" };
  const monster = { id: "side", col: 2, row: 1, facing: "up", stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  assert.equal(auto.nextIntent({ afterManualFace: "up" }), null);
  monster.facing = "left";
  assert.equal(auto.nextIntent({ afterManualFace: "up" }), "up");
  monster.facing = "right";
  assert.equal(auto.nextIntent({ afterManualFace: "up" }), null);
});

test("retreat needs a living adjacent opponent facing through an open edge", () => {
  const world = generateWorld({ width: 4, height: 3, seed: 1 });
  const player = { col: 1, row: 1, facing: "up" };
  const monster = { id: "side", col: 2, row: 1, facing: "left", stats: { health: 10 } };
  const auto = createAutomatic(player, [monster], world);

  assert.equal(auto.nextIntent({ afterManualFace: "up" }), "up");
  world.at(1, 1).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  assert.equal(auto.nextIntent({ afterManualFace: "up" }), null);
  world.at(1, 1).wallRight = null;
  monster.stats.health = 0;
  assert.equal(auto.nextIntent({ afterManualFace: "up" }), null);
  monster.stats.health = 10;
  monster.col = 3;
  assert.equal(auto.nextIntent({ afterManualFace: "up" }), null);
});

test("held control suppresses combat, but not the immediate retreat after a manual face", () => {
  const player = { col: 1, row: 1, facing: "down" };
  const monster = { id: "front", col: 1, row: 2, facing: "up", stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  assert.equal(auto.nextIntent({ afterManualFace: "down", allowCombat: false }), "down");
  monster.facing = "left";
  assert.equal(auto.nextIntent({ afterManualFace: "down", allowCombat: false }), null);
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: monster.id });
});

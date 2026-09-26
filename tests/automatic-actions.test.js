import assert from "node:assert/strict";
import test from "node:test";

import { createAutomaticActions } from "../src/game/actions/automatic-actions.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";
import { createCharacterFixture } from "./fixtures/character.js";

function createAutomatic(
  player,
  monsters,
  world = generateWorld({ width: 4, height: 4, seed: 1 }),
  character = createCharacterFixture(),
) {
  return createAutomaticActions({ world, player, monsters, character });
}

function engage(monster, cell = monster) {
  return {
    kind: "engage",
    targetId: monster.id,
    targetCell: { col: cell.col, row: cell.row },
  };
}

test("a front neighbour takes priority over side neighbours regardless of monster order", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const front = { id: "front", col: 2, row: 1, facing: "right", stats: { health: 10 } };
  const side = { id: "side", col: 1, row: 0, facing: "down", stats: { health: 10 } };

  for (const monsters of [[front, side], [side, front]]) {
    const auto = createAutomatic(player, monsters);
    assert.deepEqual(auto.nextIntent(), engage(front));
  }
});

test("a passive side neighbour is engaged and side ties follow stable monster order", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const up = { id: "up", col: 1, row: 0, facing: "up", stats: { health: 10 } };
  const down = { id: "down", col: 1, row: 2, facing: "down", stats: { health: 10 } };
  const auto = createAutomatic(player, [down, up]);

  assert.deepEqual(auto.nextIntent(), engage(down));
  down.stats.health = 0;
  assert.deepEqual(auto.nextIntent(), engage(up));
  up.col = 3;
  assert.equal(auto.nextIntent(), null);
});

test("a wall makes a neighbouring monster unavailable, so another open target is chosen", () => {
  const world = generateWorld({ width: 4, height: 4, seed: 1 });
  const player = { col: 1, row: 1, facing: "right" };
  const front = { id: "front", col: 2, row: 1, stats: { health: 10 } };
  const side = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutomatic(player, [front, side], world);

  world.at(1, 1).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  assert.deepEqual(auto.nextIntent(), engage(side));
  world.at(1, 0).wallDown = createWall({ health: 20, defense: 2, impactWear: 1 });
  assert.equal(auto.nextIntent(), null);
});

test("a monster approaching a neighbouring cell becomes eligible before arrival", () => {
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
  monster.move.elapsed = 7;
  assert.deepEqual(auto.nextIntent(), engage(monster, { col: 2, row: 1 }));
  monster.col = 2;
  monster.move = null;
  assert.deepEqual(auto.nextIntent(), engage(monster));
});

test("an occupied neighbour takes precedence over an approaching one", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const approaching = {
    id: "approaching", col: 3, row: 1, stats: { health: 10 },
    move: { kind: "step", dx: -1, dy: 0, elapsed: 8, timeCost: 10 },
  };
  const neighbour = { id: "neighbour", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutomatic(player, [approaching, neighbour]);

  assert.deepEqual(auto.nextIntent(), engage(neighbour));
  neighbour.stats.health = 0;
  assert.deepEqual(auto.nextIntent(), engage(approaching, { col: 2, row: 1 }));
});

test("approaching targets prefer the front, then stable monster order", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const down = {
    id: "down", col: 1, row: 3, stats: { health: 10 },
    move: { kind: "step", dx: 0, dy: -1, elapsed: 8, timeCost: 10 },
  };
  const right = {
    id: "right", col: 3, row: 1, stats: { health: 10 },
    move: { kind: "step", dx: -1, dy: 0, elapsed: 8, timeCost: 10 },
  };
  const auto = createAutomatic(player, [down, right]);

  assert.deepEqual(auto.nextIntent(), engage(right, { col: 2, row: 1 }));
  right.stats.health = 0;
  assert.deepEqual(auto.nextIntent(), engage(down, { col: 1, row: 2 }));
});

test("prediction uses the remaining frame time and the cost of facing", () => {
  const player = { col: 1, row: 2, facing: "right" };
  const monster = {
    id: "approaching", col: 1, row: 0, stats: { health: 10 },
    move: { kind: "step", dx: 0, dy: 1, elapsed: 10, timeCost: 16 },
  };
  const character = createCharacterFixture({ actionCosts: { face: 1, attack: 5 } });
  const auto = createAutomatic(player, [monster], undefined, character);

  assert.equal(auto.nextIntent(), null);
  assert.deepEqual(
    auto.nextIntent({ frameElapsed: 1 }),
    engage(monster, { col: 1, row: 1 }),
  );
  assert.equal(auto.nextIntent({ frameElapsed: 1, allowCombat: false }), null);
});

test("a wall or a step away cannot create an approaching target", () => {
  const world = generateWorld({ width: 4, height: 4, seed: 1 });
  const player = { col: 1, row: 1, facing: "right" };
  const monster = {
    id: "moving", col: 3, row: 1, stats: { health: 10 },
    move: { kind: "step", dx: -1, dy: 0, elapsed: 8, timeCost: 10 },
  };
  const auto = createAutomatic(player, [monster], world);

  world.at(1, 1).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  assert.equal(auto.nextIntent(), null);
  world.at(1, 1).wallRight = null;
  monster.move.dx = 0;
  monster.move.dy = 1;
  assert.equal(auto.nextIntent(), null);
  monster.col = 2;
  monster.row = 1;
  assert.deepEqual(auto.nextIntent(), engage(monster), "a current neighbour keeps its priority even when leaving");
});

test("a completed manual face takes one step direction before automatic combat when threatened", () => {
  const player = { col: 1, row: 1, facing: "down" };
  const monster = { id: "front", col: 1, row: 2, facing: "up", stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  assert.equal(auto.nextIntent({ afterManualFace: "down" }), "down");
  assert.deepEqual(auto.nextIntent(), engage(monster));
});

test("a completed manual face checks the live threat, not the state at key press", () => {
  const player = { col: 1, row: 1, facing: "up" };
  const monster = { id: "side", col: 2, row: 1, facing: "up", stats: { health: 10 } };
  const auto = createAutomatic(player, [monster]);

  assert.deepEqual(auto.nextIntent({ afterManualFace: "up" }), engage(monster));
  monster.facing = "left";
  assert.equal(auto.nextIntent({ afterManualFace: "up" }), "up");
  monster.facing = "right";
  assert.deepEqual(auto.nextIntent({ afterManualFace: "up" }), engage(monster));
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
  assert.deepEqual(auto.nextIntent(), engage(monster));
});

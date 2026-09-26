import assert from "node:assert/strict";
import test from "node:test";

import { createAutoCombat } from "../src/game/actions/auto-combat.js";

test("a front neighbour is engaged, while a side neighbour is ignored until it attacks", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const front = { id: "front", col: 2, row: 1, stats: { health: 10 } };
  const side = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutoCombat({ player, monsters: [front, side] });

  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "front" });
  auto.onAttackStart({ monsterId: "side" });
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "side" });
  player.facing = "up";
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: "side" });
});

test("a departed or dead attacker cannot force a stale reaction", () => {
  const player = { col: 1, row: 1, facing: "right" };
  const monster = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutoCombat({ player, monsters: [monster] });

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
  const auto = createAutoCombat({ player, monsters: [monster] });

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
    const auto = createAutoCombat({ player, monsters });
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
  const auto = createAutoCombat({ player, monsters: [monster] });

  assert.equal(auto.nextIntent(), null);
  monster.col = 2;
  monster.move = null;
  assert.deepEqual(auto.nextIntent(), { kind: "engage", targetId: monster.id });
});

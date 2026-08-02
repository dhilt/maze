import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createAttack } from "../src/game/actions/attack.js";
import { createStatWear } from "../src/game/stat-wear.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

test("attack is inactive until begun", () => {
  const attack = createAttack();
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
});

test("attack runs for its time cost then clears", () => {
  const attack = createAttack();
  attack.begin({ timeCost: 5 });
  assert.equal(attack.active, true);

  assert.equal(attack.update(4.9), 0);
  assert.equal(attack.active, true);

  const leftover = attack.update(0.2); // 5.1 → completes, 0.1 leftover
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
  assert.ok(Math.abs(leftover - 0.1) < 1e-9);
});

test("a wall attack damages on completion and removes the wall at zero", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  world.at(1, 1).wallRight = createWall({ health: 10, defense: 2, impactWear: 1 });
  const character = createCharacter({ stats: { attack: 7 } });
  const statWear = createStatWear({ character });
  const attack = createAttack({ world, character, statWear });
  const resolved = {
    kind: "wallAttack",
    timeCost: 5,
    target: { x: 1, y: 1, dx: 1, dy: 0 },
  };

  attack.begin(resolved);
  attack.update(4.9);
  assert.equal(world.at(1, 1).wallRight.stats.health, 10, "damage lands with the action");
  attack.update(0.1);
  assert.equal(world.at(1, 1).wallRight.stats.health, 5);
  assert.equal(statWear.remaining("attack"), 0.89);

  attack.begin(resolved);
  attack.update(5);
  assert.equal(world.at(1, 1).wallRight, null);
  assert.equal(statWear.remaining("attack"), 0.78);
});

test("wall impacts carry wear across attack points", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  world.at(1, 1).wallRight = createWall({
    health: 50,
    defense: 2,
    impactWear: 1,
  });
  const character = createCharacter({ stats: { attack: 7 } });
  const statWear = createStatWear({ character });
  const changes = [];
  const attack = createAttack({
    world,
    character,
    statWear,
    onStatChange: (change) => changes.push(change),
  });
  const resolved = {
    kind: "wallAttack",
    timeCost: 5,
    target: { x: 1, y: 1, dx: 1, dy: 0 },
  };

  for (let hit = 0; hit < 10; hit++) {
    attack.begin(resolved);
    attack.update(5);
  }

  assert.equal(character.stats.attack, 6);
  assert.equal(world.at(1, 1).wallRight, null, "the tenth hit uses Attack 7 before wear lands");
  assert.equal(statWear.remaining("attack"), 0.9);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].lost, 1);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createStatWear } from "../src/game/stat-wear.js";
import { createWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";
import { createAttackFixture } from "./fixtures/attack.js";
import { createCharacterFixture } from "./fixtures/character.js";

test("attack runs for its time cost then clears", () => {
  const attack = createAttackFixture();
  attack.begin({ timeCost: 5 });
  assert.equal(attack.active, true);

  assert.equal(attack.update(4.9), 0);
  assert.equal(attack.active, true);

  const leftover = attack.update(0.2); // 5.1 → completes, 0.1 leftover
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
  assert.ok(Math.abs(leftover - 0.1) < 1e-9);
});

test("an attacked cell is checked at the shared attack peak", () => {
  const impacts = [];
  const attack = createAttackFixture({
    onImpact: (impact) => {
      impacts.push({ ...impact, strike: undefined });
      impact.strike.hitResolved = true;
    },
  });
  attack.begin({
    kind: "attack",
    timeCost: 5,
    targetCell: { col: 2, row: 1 },
  });

  attack.update(2);
  attack.update(4, 1.5);

  assert.deepEqual(impacts, [{
    at: 2,
    attacker: { type: "player" },
    targetCell: { col: 2, row: 1 },
    strike: undefined,
  }]);
});

test("an empty strike remains active briefly after its peak", () => {
  const impacts = [];
  const attack = createAttackFixture({
    onImpact: (impact) => {
      impacts.push(impact);
      if (impacts.length === 2) impact.strike.hitResolved = true;
    },
  });
  attack.begin({
    kind: "attack",
    timeCost: 5,
    targetCell: { col: 2, row: 1 },
  });

  attack.update(2.5);
  attack.update(0.5);
  attack.update(0.1);

  assert.equal(impacts.length, 2);
  assert.equal(impacts[0].at, 2.5);
  assert.equal(impacts[1].at, 0);
});

test("a wall attack damages at contact and removes the wall at zero", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  world.at(1, 1).wallRight = createWall({ health: 10, defense: 2, impactWear: 1 });
  const character = createCharacterFixture({ stats: { attack: 7 } });
  const statWear = createStatWear({ character });
  const attack = createAttackFixture({
    world,
    character,
    statWear,
    damageRoll: () => 0.5,
  });
  const resolved = {
    kind: "attack",
    timeCost: 5,
    target: { x: 1, y: 1, dx: 1, dy: 0 },
  };

  attack.begin(resolved);
  attack.update(2.4);
  assert.equal(world.at(1, 1).wallRight.stats.health, 10, "damage waits for contact");
  attack.update(0.1);
  assert.equal(world.at(1, 1).wallRight.stats.health, 5);
  assert.equal(statWear.remaining("attack"), 0.89);
  attack.update(2.5);
  assert.equal(attack.active, false, "recovery continues after contact");

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
  const character = createCharacterFixture({ stats: { attack: 7 } });
  const statWear = createStatWear({ character });
  const changes = [];
  const attack = createAttackFixture({
    world,
    character,
    statWear,
    damageRoll: () => 0.5,
    onStatChange: (change) => changes.push(change),
  });
  const resolved = {
    kind: "attack",
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

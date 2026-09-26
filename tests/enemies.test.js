import assert from "node:assert/strict";
import test from "node:test";

import { createMeatMonster } from "../src/entities/meat-monster.js";
import { createCharacterFixture } from "./fixtures/character.js";
import { createMeatMonsterFixture } from "./fixtures/meat-monster.js";
import { createActionAdapter } from "../src/game/actions/adapter.js";
import { ATTACK_CONTACT_PROGRESS } from "../src/game/actions/attack-timing.js";
import {
  createEnemySystem,
  spawnMeatMonsters,
} from "../src/game/enemies/enemy-system.js";
import { createWall, hasWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

function createSystem({
  world,
  player,
  monsters,
  seed = 1,
  directionChangeChance = 0,
  playerMove = null,
  onImpact = () => {},
  onAttackStart,
}) {
  return createEnemySystem({
    world,
    player,
    getPlayerMove: () => playerMove,
    monsters,
    seed,
    directionChangeChance,
    onImpact,
    onAttackStart,
  });
}

test("meat monster generation applies its random ranges", () => {
  const minimum = createMeatMonster({
    id: "minimum",
    col: 0,
    row: 0,
    facing: "down",
    random: () => 0,
  });
  const maximum = createMeatMonster({
    id: "maximum",
    col: 0,
    row: 0,
    facing: "down",
    random: () => 0.999999,
  });

  for (const stat of Object.keys(minimum.stats)) {
    assert.ok(Number.isInteger(minimum.stats[stat]));
    assert.ok(maximum.stats[stat] > minimum.stats[stat]);
  }
  assert.ok(maximum.carcass.nutrition > minimum.carcass.nutrition);
});

test("every production meat monster owns independent mutable state", () => {
  const first = createMeatMonster({
    id: "m1",
    col: 0,
    row: 0,
    facing: "down",
    random: () => 0.5,
  });
  const second = createMeatMonster({
    id: "m2",
    col: 1,
    row: 0,
    facing: "down",
    random: () => 0.5,
  });
  const firstInitial = { ...first.stats };
  const secondInitial = { ...second.stats };

  assert.deepEqual(first.stats, first.statsMax);
  assert.notEqual(first.stats, first.statsMax);
  assert.notEqual(first.stats, second.stats);
  assert.notEqual(first.actionCosts, second.actionCosts);
  assert.ok(Number.isFinite(first.impactWear));
  assert.ok(first.impactWear >= 0);
  for (const efficiency of [
    first.attackEfficiency,
    first.defenseEfficiency,
    second.attackEfficiency,
    second.defenseEfficiency,
  ]) {
    assert.ok(Number.isFinite(efficiency));
    assert.ok(efficiency >= 0 && efficiency <= 1);
  }
  first.stats.health = 0;
  assert.equal(first.statsMax.health, firstInitial.health);
  assert.deepEqual(second.stats, secondInitial);
});

test("direction-change chance rejects values outside the probability range", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const setup = (directionChangeChance) => createSystem({
    world,
    player: { col: 0, row: 0 },
    monsters: [],
    directionChangeChance,
  });

  assert.throws(() => setup(-Number.EPSILON), /directionChangeChance/);
  assert.throws(() => setup(1 + Number.EPSILON), /directionChangeChance/);
  assert.doesNotThrow(() => setup(0));
  assert.doesNotThrow(() => setup(1));
});

test("zero and full chance control sudden direction changes", () => {
  const world = generateWorld({ width: 5, height: 1, seed: 1 });
  const player = { col: 0, row: 0 };
  const steady = createMeatMonsterFixture({ id: "steady", col: 2, row: 0, facing: "right" });
  const changing = createMeatMonsterFixture({ id: "changing", col: 2, row: 0, facing: "right" });

  createSystem({
    world,
    player,
    monsters: [steady],
    seed: 1,
    directionChangeChance: 0,
  }).update(0.1);
  createSystem({
    world,
    player,
    monsters: [changing],
    seed: 1,
    directionChangeChance: 1,
  }).update(0.1);

  assert.equal(steady.move.facing, "right");
  assert.equal(changing.move.facing, "left");
});

test("a blocked monster chooses its reverse as readily as either side turn", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  world.at(1, 0).wallDown = createWall({ health: 20, defense: 2, impactWear: 1 });
  const player = { col: 0, row: 0 };
  const expectedBySeed = new Map([[0, "down"], [1, "left"], [4, "right"]]);

  for (const [seed, expected] of expectedBySeed) {
    const monster = createMeatMonsterFixture({
      id: `m-${seed}`,
      col: 1,
      row: 1,
      facing: "up",
    });
    createSystem({ world, player, monsters: [monster], seed }).update(0.1);
    assert.equal(monster.move.facing, expected);
  }
});

test("meat monster spawning is deterministic, unique, and avoids the hero", () => {
  const world = generateWorld({ width: 4, height: 3, seed: 1 });
  const player = { col: 2, row: 1 };
  world.at(0, 0).exit = { kind: "exit", phase: "hidden" };

  const first = spawnMeatMonsters({ world, player, count: 6, seed: 19 });
  const second = spawnMeatMonsters({ world, player, count: 6, seed: 19 });
  const snapshot = (monsters) => monsters.map(({
    id,
    col,
    row,
    facing,
    stats,
    carcass,
    moraleReward,
  }) => ({
    id, col, row, facing, stats, carcass, moraleReward,
  }));

  assert.deepEqual(snapshot(first), snapshot(second));
  assert.equal(new Set(first.map(({ col, row }) => `${col}:${row}`)).size, first.length);
  assert.ok(first.every(({ col, row }) => col !== player.col || row !== player.row));
  for (const monster of first) {
    assert.notEqual(monster.stats, monster.statsMax);
    for (const value of Object.values(monster.stats)) {
      assert.ok(Number.isInteger(value));
      assert.ok(value >= 0);
    }
    assert.ok(Number.isInteger(monster.carcass.nutrition));
    assert.ok(monster.carcass.nutrition > 0);
    assert.ok(Number.isFinite(monster.carcass.moraleCost));
    assert.ok(Number.isFinite(monster.moraleReward));
  }
  assert.ok(first.some(({ col, row }) => (
    Math.max(Math.abs(col - player.col), Math.abs(row - player.row)) <= 3 &&
    Math.abs(col - player.col) + Math.abs(row - player.row) >= 2
  )));
});

test("a monster may spawn on a hidden exit cell", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const player = { col: 0, row: 0 };
  world.at(1, 0).exit = { kind: "exit", phase: "hidden" };

  const monsters = spawnMeatMonsters({ world, player, count: 1, seed: 19 });

  assert.equal(monsters.length, 1);
  assert.deepEqual([monsters[0].col, monsters[0].row], [1, 0]);
});

test("a moving monster uses its own step cost and reserves only its destination", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  const monster = createMeatMonsterFixture({
    id: "m1",
    col: 1,
    row: 0,
    facing: "right",
    actionCosts: { step: 7 },
  });
  const system = createSystem({
    world,
    player: { col: 0, row: 0 },
    monsters: [monster],
  });

  system.update(2.5);

  assert.deepEqual([monster.move.dx, monster.move.dy], [1, 0]);
  assert.equal(monster.move.timeCost, 7);
  assert.equal(monster.move.elapsed, 2.5);
  assert.equal(system.findEntryBlocker(0, 0, 1, 0), null);
  assert.equal(system.findEntryBlocker(3, 0, 2, 0), monster);
});

test("one monster may follow another into the cell it is leaving", () => {
  const world = generateWorld({ width: 5, height: 1, seed: 1 });
  const leader = createMeatMonsterFixture({ id: "leader", col: 2, row: 0, facing: "right" });
  const follower = createMeatMonsterFixture({ id: "follower", col: 1, row: 0, facing: "right" });
  const system = createSystem({
    world,
    player: { col: 4, row: 0 },
    monsters: [leader, follower],
    seed: 2,
  });

  system.update(1);

  assert.deepEqual([leader.move.dx, leader.move.dy], [1, 0]);
  assert.deepEqual([follower.move.dx, follower.move.dy], [1, 0]);
});

test("hero and monster may follow each other into a vacated source cell", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  const player = { col: 0, row: 0, facing: "right" };
  const monster = createMeatMonsterFixture({ id: "m1", col: 1, row: 0, facing: "right" });
  const system = createSystem({ world, player, monsters: [monster] });

  system.update(1); // monster starts 1 -> 2
  const adapter = createActionAdapter({
    world,
    player,
    character: createCharacterFixture({ actionCosts: { step: 5 } }),
    findEntryBlocker: system.findEntryBlocker,
    findEntityById: () => null,
  });
  assert.equal(adapter.adapt("right").kind, "step", "hero follows monster");

  const followingMonster = createMeatMonsterFixture({
    id: "m2",
    col: 1,
    row: 0,
    facing: "right",
  });
  const followingSystem = createSystem({
    world,
    player: { col: 2, row: 0 },
    playerMove: { kind: "step", dx: 1, dy: 0, elapsed: 1, timeCost: 5 },
    monsters: [followingMonster],
  });
  followingSystem.update(1);
  assert.deepEqual(
    [followingMonster.move.dx, followingMonster.move.dy],
    [1, 0],
    "monster follows hero",
  );
});

test("a frontal collision attacks, while a side collision only turns", () => {
  const world = generateWorld({ width: 3, height: 1, seed: 1 });
  const player = { col: 1, row: 0 };
  const frontal = createMeatMonsterFixture({
    id: "front",
    col: 0,
    row: 0,
    facing: "right",
    actionCosts: { attack: 7 },
  });
  const frontalSystem = createSystem({ world, player, monsters: [frontal] });
  frontalSystem.update(1);
  assert.equal(frontal.move, null);
  assert.equal(frontal.attack.kind, "attack");
  assert.equal(frontal.attack.timeCost, 7);
  assert.deepEqual(frontal.attack.targetCell, { col: 1, row: 0 });

  const sideways = createMeatMonsterFixture({
    id: "side",
    col: 0,
    row: 0,
    facing: "left",
    actionCosts: { face: 2 },
  });
  const sidewaysSystem = createSystem({ world, player, monsters: [sideways] });
  sidewaysSystem.update(1);
  assert.equal(sideways.attack, null);
  assert.equal(sideways.move.kind, "face");
  assert.equal(sideways.move.timeCost, 2);
  assert.equal(sideways.facing, "right");
});

test("the hero can attack a retreating monster without forcing a counterattack", () => {
  const world = generateWorld({ width: 3, height: 1, seed: 1 });
  const player = { col: 0, row: 0, facing: "right" };
  const retreating = createMeatMonsterFixture({
    id: "m2",
    col: 1,
    row: 0,
    facing: "right",
  });
  const system = createSystem({ world, player, monsters: [retreating] });
  const adapter = createActionAdapter({
    world,
    player,
    character: createCharacterFixture({ actionCosts: { attack: 5 } }),
    findEntryBlocker: system.findEntryBlocker,
    findEntityById: () => null,
  });

  assert.equal(adapter.adapt("right").kind, "attack");
  system.update(1);
  assert.equal(retreating.attack, null);
  assert.deepEqual([retreating.move.dx, retreating.move.dy], [1, 0]);
});

test("a monster keeps attacking while the hero remains in its frontal cell", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  const player = { col: 2, row: 0 };
  const monster = createMeatMonsterFixture({
    id: "m1",
    col: 1,
    row: 0,
    facing: "right",
  });
  const system = createSystem({ world, player, monsters: [monster] });
  const attackCost = monster.actionCosts.attack;

  system.update(attackCost * 3 + 1);
  assert.deepEqual([monster.col, monster.row], [1, 0]);
  assert.equal(monster.attack.kind, "attack");
  assert.equal(monster.attack.elapsed, 1);

  player.col = 3;
  system.update(attackCost - 1); // the already-started attack still finishes
  assert.equal(monster.attack, null);
  system.update(1);
  assert.equal(monster.move.kind, "step");
  assert.deepEqual([monster.move.dx, monster.move.dy], [1, 0]);
});

test("a monster queues one hit at the shared contact peak", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const monster = createMeatMonsterFixture({ id: "m1", col: 1, row: 0, facing: "left" });
  const impacts = [];
  const system = createSystem({
    world,
    player: { col: 0, row: 0 },
    monsters: [monster],
    onImpact: (impact) => {
      impacts.push({ ...impact, strike: undefined });
      impact.strike.hitResolved = true;
    },
  });
  const contactElapsed = monster.actionCosts.attack * ATTACK_CONTACT_PROGRESS;
  const epsilon = 0.1;

  system.update(contactElapsed - epsilon);
  assert.equal(impacts.length, 0);
  system.update(epsilon * 2);

  assert.equal(impacts.length, 1);
  assert.ok(Math.abs(impacts[0].at - epsilon) < 1e-9);
  assert.deepEqual({ ...impacts[0], at: epsilon }, {
    at: epsilon,
    attacker: { type: "entity", id: "m1" },
    targetCell: { col: 0, row: 0 },
    strike: undefined,
  });
});

test("a monster announces each attack at its start, even when no hit follows", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const player = { col: 0, row: 0 };
  const monster = createMeatMonsterFixture({ id: "m1", col: 1, row: 0, facing: "left" });
  const starts = [];
  const system = createSystem({
    world,
    player,
    monsters: [monster],
    onAttackStart: (event) => starts.push(event),
  });

  system.update(0.1);
  assert.deepEqual(starts, [{ monsterId: monster.id, targetCell: { col: 0, row: 0 } }]);
  player.col = 2; // the already-started swing misses, but was still a threat
  system.update(monster.actionCosts.attack);
  assert.equal(starts.length, 1);
});

test("monsters cannot cross walls or enter the hero's current or reserved cell", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  world.at(0, 0).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const monster = createMeatMonsterFixture({ id: "m1", col: 1, row: 0, facing: "right" });
  const system = createSystem({
    world,
    player: { col: 3, row: 0 },
    playerMove: { kind: "step", dx: -1, dy: 0, elapsed: 1, timeCost: 5 },
    monsters: [monster],
  });

  system.update(20);

  assert.deepEqual([monster.col, monster.row], [1, 0]);
  assert.equal(monster.move, null);
});

test("monster reservations prevent overlap and position swaps", () => {
  const world = generateWorld({ width: 5, height: 3, seed: 1 });
  const player = { col: 2, row: 1 };
  const monsters = [
    createMeatMonsterFixture({
      id: "m1", col: 0, row: 0, facing: "right", actionCosts: { step: 3 },
    }),
    createMeatMonsterFixture({
      id: "m2", col: 1, row: 0, facing: "left", actionCosts: { step: 3 },
    }),
    createMeatMonsterFixture({
      id: "m3", col: 4, row: 2, facing: "up", actionCosts: { step: 3 },
    }),
  ];
  const system = createSystem({ world, player, monsters, seed: 7 });

  for (let frame = 0; frame < 80; frame += 1) {
    system.update(0.5);
    const sources = new Set();
    const targets = new Set();
    for (const monster of monsters) {
      assert.notDeepEqual([monster.col, monster.row], [player.col, player.row]);
      const source = `${monster.col}:${monster.row}`;
      assert.equal(sources.has(source), false, `duplicate source ${source}`);
      sources.add(source);
      if (!monster.move) continue;
      assert.equal(
        hasWall(world, monster.col, monster.row, monster.move.dx, monster.move.dy),
        false,
      );
      const target = `${monster.col + monster.move.dx}:${monster.row + monster.move.dy}`;
      assert.equal(targets.has(target), false, `duplicate target ${target}`);
      targets.add(target);
      for (const other of monsters) {
        if (other === monster) continue;
        if (!other.move) {
          assert.notEqual(target, `${other.col}:${other.row}`);
          continue;
        }
        const otherTarget = `${other.col + other.move.dx}:${other.row + other.move.dy}`;
        const swapsPositions = (
          target === `${other.col}:${other.row}` && otherTarget === source
        );
        assert.equal(swapsPositions, false, "head-on position swap");
      }
    }
  }
});

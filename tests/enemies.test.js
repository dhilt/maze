import assert from "node:assert/strict";
import test from "node:test";

import {
  createMeatMonster,
  createMeatMonsterStats,
  MEAT_MONSTER_DIRECTION_CHANGE_CHANCE,
  MEAT_MONSTER_IMPACT_WEAR,
  MEAT_MONSTER_MAX_MORALE_COST,
  MEAT_MONSTER_MAX_NUTRITION,
  MEAT_MONSTER_MAX_STATS,
  MEAT_MONSTER_MIN_MORALE_COST,
  MEAT_MONSTER_MIN_NUTRITION,
  MEAT_MONSTER_MIN_STATS,
} from "../src/entities/meat-monster.js";
import { createActionAdapter } from "../src/game/actions/adapter.js";
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
  stepCost = 5,
  turnCost = 1,
  attackCost = 5,
  seed = 1,
  directionChangeChance = 0,
  playerMove = null,
  onImpact,
}) {
  return createEnemySystem({
    world,
    player,
    getPlayerMove: () => playerMove,
    monsters,
    stepCost,
    turnCost,
    attackCost,
    seed,
    directionChangeChance,
    onImpact,
  });
}

test("meat monster stats use the configured inclusive intervals", () => {
  const minimum = createMeatMonsterStats(() => 0);
  const maximum = createMeatMonsterStats(() => 0.999999);

  for (const [name, min] of Object.entries(MEAT_MONSTER_MIN_STATS)) {
    assert.equal(minimum[name], min);
    assert.equal(maximum[name], MEAT_MONSTER_MAX_STATS[name]);
  }
});

test("every meat monster owns independent current and maximum stats", () => {
  const first = createMeatMonster({ id: "m1", col: 0, row: 0, random: () => 0.5 });
  const second = createMeatMonster({ id: "m2", col: 1, row: 0, random: () => 0.5 });
  const firstInitial = { ...first.stats };
  const secondInitial = { ...second.stats };

  assert.deepEqual(first.stats, first.statsMax);
  assert.notEqual(first.stats, first.statsMax);
  assert.notEqual(first.stats, second.stats);
  assert.equal(first.impactWear, MEAT_MONSTER_IMPACT_WEAR);
  first.stats.health = 0;
  assert.equal(first.statsMax.health, firstInitial.health);
  assert.deepEqual(second.stats, secondInitial);
});

test("the configured direction-change chance is a valid probability", () => {
  assert.ok(Number.isFinite(MEAT_MONSTER_DIRECTION_CHANGE_CHANCE));
  assert.ok(MEAT_MONSTER_DIRECTION_CHANGE_CHANCE >= 0);
  assert.ok(MEAT_MONSTER_DIRECTION_CHANGE_CHANCE <= 1);
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
  const steady = createMeatMonster({ id: "steady", col: 2, row: 0, facing: "right" });
  const changing = createMeatMonster({ id: "changing", col: 2, row: 0, facing: "right" });

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
    const monster = createMeatMonster({
      id: `m-${seed}`,
      col: 1,
      row: 1,
      facing: "up",
    });
    createSystem({ world, player, monsters: [monster], seed }).update(0.1);
    assert.equal(monster.move.facing, expected);
  }
});

test("meat monster spawning is deterministic, unique, and avoids hero and exit", () => {
  const world = generateWorld({ width: 4, height: 3, seed: 1 });
  const player = { col: 2, row: 1 };
  world.at(0, 0).exit = true;

  const first = spawnMeatMonsters({ world, player, count: 6, seed: 19 });
  const second = spawnMeatMonsters({ world, player, count: 6, seed: 19 });
  const snapshot = (monsters) => monsters.map(({
    id,
    col,
    row,
    facing,
    stats,
    nutrition,
    moraleCost,
  }) => ({
    id, col, row, facing, stats, nutrition, moraleCost,
  }));

  assert.deepEqual(snapshot(first), snapshot(second));
  assert.equal(new Set(first.map(({ col, row }) => `${col}:${row}`)).size, first.length);
  assert.ok(first.every(({ col, row }) => col !== player.col || row !== player.row));
  assert.ok(first.every(({ col, row }) => !world.at(col, row).exit));
  for (const monster of first) {
    assert.notEqual(monster.stats, monster.statsMax);
    for (const [name, min] of Object.entries(MEAT_MONSTER_MIN_STATS)) {
      assert.ok(monster.stats[name] >= min);
      assert.ok(monster.stats[name] <= MEAT_MONSTER_MAX_STATS[name]);
    }
    assert.ok(monster.nutrition >= MEAT_MONSTER_MIN_NUTRITION);
    assert.ok(monster.nutrition <= MEAT_MONSTER_MAX_NUTRITION);
    assert.ok(monster.moraleCost >= MEAT_MONSTER_MIN_MORALE_COST);
    assert.ok(monster.moraleCost <= MEAT_MONSTER_MAX_MORALE_COST);
  }
  assert.ok(first.some(({ col, row }) => (
    Math.max(Math.abs(col - player.col), Math.abs(row - player.row)) <= 3 &&
    Math.abs(col - player.col) + Math.abs(row - player.row) >= 2
  )));
});

test("a moving monster frees its source but reserves its destination", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  const monster = createMeatMonster({ id: "m1", col: 1, row: 0, facing: "right" });
  const system = createSystem({
    world,
    player: { col: 0, row: 0 },
    monsters: [monster],
  });

  system.update(2.5);

  assert.deepEqual([monster.move.dx, monster.move.dy], [1, 0]);
  assert.equal(monster.move.elapsed, 2.5);
  assert.equal(system.findEntryBlocker(0, 0, 1, 0), null);
  assert.equal(system.findEntryBlocker(3, 0, 2, 0), monster);
});

test("one monster may follow another into the cell it is leaving", () => {
  const world = generateWorld({ width: 5, height: 1, seed: 1 });
  const leader = createMeatMonster({ id: "leader", col: 2, row: 0, facing: "right" });
  const follower = createMeatMonster({ id: "follower", col: 1, row: 0, facing: "right" });
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
  const monster = createMeatMonster({ id: "m1", col: 1, row: 0, facing: "right" });
  const system = createSystem({ world, player, monsters: [monster] });

  system.update(1); // monster starts 1 -> 2
  const adapter = createActionAdapter({
    world,
    player,
    costs: { step: 5, turn: 1, attack: 5 },
    findEntryBlocker: system.findEntryBlocker,
  });
  assert.equal(adapter.adapt("right").kind, "step", "hero follows monster");

  const followingMonster = createMeatMonster({
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
  const frontal = createMeatMonster({
    id: "front",
    col: 0,
    row: 0,
    facing: "right",
  });
  const frontalSystem = createSystem({ world, player, monsters: [frontal] });
  frontalSystem.update(1);
  assert.equal(frontal.move, null);
  assert.equal(frontal.attack.kind, "attack");
  assert.deepEqual(frontal.attack.targetCell, { col: 1, row: 0 });

  const sideways = createMeatMonster({
    id: "side",
    col: 0,
    row: 0,
    facing: "left",
  });
  const sidewaysSystem = createSystem({ world, player, monsters: [sideways] });
  sidewaysSystem.update(1);
  assert.equal(sideways.attack, null);
  assert.equal(sideways.move, null);
  assert.equal(sideways.facing, "right");
});

test("hero and monster can resolve simultaneous or one-sided attacks independently", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const player = { col: 0, row: 0, facing: "right" };
  const monster = createMeatMonster({
    id: "m1",
    col: 1,
    row: 0,
    facing: "left",
  });
  const system = createSystem({ world, player, monsters: [monster] });
  const adapter = createActionAdapter({
    world,
    player,
    costs: { step: 5, turn: 1, attack: 5 },
    findEntryBlocker: system.findEntryBlocker,
  });

  assert.equal(adapter.adapt("right").kind, "attack");
  system.update(1);
  assert.equal(monster.attack.kind, "attack");

  const retreatWorld = generateWorld({ width: 3, height: 1, seed: 1 });
  const retreating = createMeatMonster({
    id: "m2",
    col: 1,
    row: 0,
    facing: "right",
  });
  const oneSidedSystem = createSystem({
    world: retreatWorld,
    player,
    monsters: [retreating],
  });
  const oneSidedAdapter = createActionAdapter({
    world: retreatWorld,
    player,
    costs: { step: 5, turn: 1, attack: 5 },
    findEntryBlocker: oneSidedSystem.findEntryBlocker,
  });
  assert.equal(oneSidedAdapter.adapt("right").kind, "attack");
  oneSidedSystem.update(1);
  assert.equal(retreating.attack, null);
  assert.deepEqual([retreating.move.dx, retreating.move.dy], [1, 0]);
});

test("a monster keeps attacking while the hero remains in its frontal cell", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  const player = { col: 2, row: 0 };
  const monster = createMeatMonster({
    id: "m1",
    col: 1,
    row: 0,
    facing: "right",
  });
  const system = createSystem({ world, player, monsters: [monster] });

  system.update(16);
  assert.deepEqual([monster.col, monster.row], [1, 0]);
  assert.equal(monster.attack.kind, "attack");
  assert.equal(monster.attack.elapsed, 1);

  player.col = 3;
  system.update(4); // the already-started attack still finishes
  assert.equal(monster.attack, null);
  system.update(1);
  assert.equal(monster.move.kind, "step");
  assert.deepEqual([monster.move.dx, monster.move.dy], [1, 0]);
});

test("a monster queues one hit at the shared contact peak", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 1 });
  const monster = createMeatMonster({ id: "m1", col: 1, row: 0, facing: "left" });
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

  system.update(2.4);
  assert.equal(impacts.length, 0);
  system.update(0.2);
  system.update(2);

  assert.equal(impacts.length, 1);
  assert.ok(Math.abs(impacts[0].at - 0.1) < 1e-9);
  assert.deepEqual({ ...impacts[0], at: 0.1 }, {
    at: 0.1,
    attacker: { type: "entity", id: "m1" },
    targetCell: { col: 0, row: 0 },
    strike: undefined,
  });
});

test("monsters cannot cross walls or enter the hero's current or reserved cell", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  world.at(0, 0).wallRight = createWall({ health: 20, defense: 2, impactWear: 1 });
  const monster = createMeatMonster({ id: "m1", col: 1, row: 0, facing: "right" });
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
    createMeatMonster({ id: "m1", col: 0, row: 0, facing: "right" }),
    createMeatMonster({ id: "m2", col: 1, row: 0, facing: "left" }),
    createMeatMonster({ id: "m3", col: 4, row: 2, facing: "up" }),
  ];
  const system = createSystem({ world, player, monsters, stepCost: 3, seed: 7 });

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

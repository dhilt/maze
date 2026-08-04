import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createGame } from "../src/game/game.js";
import { createWall } from "../src/world/maze.js";

const TEST_CONFIG = Object.freeze({
  cellSize: 16,
  viewCols: 5,
  viewRows: 5,
  cameraMargin: 1,
  gameTime: Object.freeze({ secondsPerUnit: 0.1, speed: 1 }),
  actionCosts: Object.freeze({ step: 5, turn: 1, attack: 5, consume: 10 }),
  enemies: Object.freeze({ meatMonster: Object.freeze({ stepCost: 8 }) }),
  debug: false,
  floorStyle: "stone",
  worldSeed: 11,
  wallDensity: 0,
  wallSeed: 17,
  baseWallHealth: 20,
  baseWallDefense: 2,
  wallImpactWear: 1,
});

function createContext() {
  return new Proxy({}, {
    get(target, property) {
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
  });
}

function keyEvent(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: false },
  });
  return event;
}

function createTestLevelBus(levels) {
  let index = 0;
  return {
    advance() {
      if (index >= levels.length - 1) return false;
      index += 1;
      return true;
    },
    get current() { return levels[index]; },
    get isLast() { return index === levels.length - 1; },
    get state() {
      return {
        number: index + 1,
        total: levels.length,
        progress: (index + 1) / levels.length,
        isLast: index === levels.length - 1,
        definition: levels[index],
      };
    },
  };
}

function withGameEnvironment(run) {
  const previous = {
    window: globalThis.window,
    Image: globalThis.Image,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };

  const target = new EventTarget();
  let nextFrame = null;
  let schedules = 0;
  let cancels = 0;

  globalThis.window = target;
  globalThis.Image = class FakeImage {
    complete = false;
    naturalWidth = 0;
  };
  globalThis.requestAnimationFrame = (callback) => {
    nextFrame = callback;
    schedules += 1;
    return schedules;
  };
  globalThis.cancelAnimationFrame = () => { cancels += 1; };

  try {
    return run({
      target,
      runFrame(deltaMs = 100) {
        assert.equal(typeof nextFrame, "function");
        nextFrame(performance.now() + deltaMs);
      },
      get schedules() { return schedules; },
      get cancels() { return cancels; },
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
}

function createTestGame({
  speed,
  health,
  exitX,
  exitY = 0,
  worldRows = 1,
  monsterCount = 0,
  levels,
}) {
  const outcomes = [];
  const testLevels = levels ?? [{
    number: 1,
    width: 5,
    height: worldRows,
    monsterCount,
  }];
  const character = createCharacter({
    name: "Integration Hero",
    stats: { health, attack: 7, defense: 5, morale: 8 },
    statsMax: { health: 20, attack: 7, defense: 5, morale: 10 },
    healthDrainSpeed: 100,
  });
  const game = createGame({
    canvas: {
      width: 0,
      height: 0,
      getContext: () => createContext(),
    },
    statsRoot: {
      innerHTML: "",
      querySelector: () => null,
    },
    debugControl: { checked: false },
    character,
    levelBus: createTestLevelBus(testLevels),
    config: {
      ...TEST_CONFIG,
      gameTime: { ...TEST_CONFIG.gameTime, speed },
    },
    onFinish: (outcome) => outcomes.push(outcome),
  });

  const state = game.getState();
  for (const cell of state.world.cells) cell.exit = false;
  state.world.at(exitX, exitY).exit = true;
  return { game, state, outcomes };
}

test("the game spawns and advances the configured meat monsters", () => {
  withGameEnvironment((environment) => {
    const { game, state } = createTestGame({
      speed: 1,
      health: 20,
      exitX: 0,
      exitY: 0,
      worldRows: 5,
      monsterCount: 3,
    });

    assert.equal(state.monsters.length, 3);
    assert.equal(
      new Set(state.monsters.map(({ col, row }) => `${col}:${row}`)).size,
      3,
    );

    game.start();
    environment.runFrame();
    assert.ok(state.monsters.some((monster) => monster.move !== null));
    game.stop();
  });
});

test("hero and monster contacts in the same frame resolve simultaneously", () => {
  withGameEnvironment((environment) => {
    const { game, state, outcomes } = createTestGame({
      speed: 2.5,
      health: 2,
      exitX: 4,
      monsterCount: 1,
    });
    const monster = state.monsters[0];
    state.player.facing = "right";
    monster.col = state.player.col + 1;
    monster.row = state.player.row;
    monster.facing = "left";
    Object.assign(monster.stats, { health: 2, attack: 7, defense: 5 });
    const corpseCell = state.world.at(monster.col, monster.row);

    environment.target.dispatchEvent(keyEvent("keydown", "Space"));
    game.start();
    environment.runFrame();

    assert.equal(state.character.stats.health, 0);
    assert.equal(state.monsters.length, 1);
    assert.equal(state.monsters[0].stats.health, 0);
    assert.equal(corpseCell.objects[0].kind, "corpse");
    assert.equal(corpseCell.objects[0].entityId, monster.id);
    assert.deepEqual(outcomes, ["died"]);
  });
});

test("the hero consumes a linked corpse with E after spending action time", () => {
  withGameEnvironment((environment) => {
    const { game, state } = createTestGame({
      speed: 10,
      health: 10,
      exitX: 4,
      monsterCount: 1,
    });
    const monster = state.monsters[0];
    monster.col = state.player.col;
    monster.row = state.player.row;
    monster.stats.health = 0;
    monster.nutrition = 6;
    monster.moraleCost = 2;
    state.character.stats.morale = 8;
    const cell = state.world.at(state.player.col, state.player.row);

    game.start();
    environment.runFrame();
    assert.equal(cell.objects[0].entityId, monster.id);

    environment.target.dispatchEvent(keyEvent("keydown", "KeyE"));
    environment.runFrame(200);

    assert.equal(state.character.stats.health, 16);
    assert.equal(state.character.stats.morale, 6);
    assert.deepEqual(cell.objects, []);
    assert.equal(state.monsters[0], monster, "the eaten entity remains in history");
    game.stop();
  });
});

test("the hero can hit a passing monster without receiving a counterattack", () => {
  withGameEnvironment((environment) => {
    const { game, state } = createTestGame({
      speed: 2.5,
      health: 20,
      exitX: 4,
      monsterCount: 1,
    });
    const monster = state.monsters[0];
    state.player.col = 0;
    state.player.facing = "right";
    monster.col = 2;
    monster.row = 0;
    monster.facing = "left";
    monster.move = {
      kind: "step",
      dx: -1,
      dy: 0,
      elapsed: 0,
      timeCost: TEST_CONFIG.enemies.meatMonster.stepCost,
      facing: "left",
    };
    Object.assign(monster.stats, { health: 20, attack: 7, defense: 5 });

    environment.target.dispatchEvent(keyEvent("keydown", "Space"));
    game.start();
    environment.runFrame();

    assert.equal(monster.stats.health, 18);
    assert.equal(state.character.stats.health, 20);
    assert.equal(monster.attack, null);
    assert.deepEqual([monster.move.dx, monster.move.dy], [-1, 0]);
    game.stop();
  });
});

test("death stops actions and wins the same-frame race against the exit", () => {
  withGameEnvironment((environment) => {
    const { game, state, outcomes } = createTestGame({
      speed: 1000,
      health: 1,
      exitX: 3,
    });

    environment.target.dispatchEvent(keyEvent("keydown", "ArrowRight"));
    game.start();
    environment.runFrame();

    assert.equal(state.character.stats.health, 0);
    assert.equal(state.player.col, 2, "dead hero must not finish the queued step");
    assert.deepEqual(outcomes, ["died"]);
    assert.equal(environment.schedules, 1, "terminal frame must not schedule another frame");
    assert.equal(environment.cancels, 1);
  });
});

test("a living hero still finishes when landing on the exit", () => {
  withGameEnvironment((environment) => {
    const { game, state, outcomes } = createTestGame({
      speed: 10,
      health: 20,
      exitX: 3,
    });

    environment.target.dispatchEvent(keyEvent("keydown", "ArrowRight"));
    game.start();
    environment.runFrame();

    assert.equal(state.character.stats.health, 20);
    assert.equal(state.player.col, 3);
    assert.deepEqual(outcomes, ["escaped"]);
  });
});

test("a portal advances the level while only the final portal finishes the run", () => {
  withGameEnvironment((environment) => {
    const characterLevels = [
      { number: 1, width: 5, height: 1, monsterCount: 1 },
      { number: 2, width: 10, height: 1, monsterCount: 3 },
    ];
    const { game, state: first, outcomes } = createTestGame({
      speed: 1,
      health: 13,
      exitX: 2,
      levels: characterLevels,
    });
    const character = first.character;

    game.start();
    environment.runFrame();

    const second = game.getState();
    assert.equal(second.level.number, 2);
    assert.equal(second.level.isLast, true);
    assert.deepEqual([second.world.width, second.world.height], [10, 1]);
    assert.equal(second.monsters.length, 3);
    assert.equal(second.monsterHistory.length, 1);
    assert.ok(second.monsterHistory[0].id.startsWith("level-1:"));
    assert.ok(second.monsters.every(({ id }) => id.startsWith("level-2:")));
    assert.equal(
      new Set(second.allMonsters.map(({ id }) => id)).size,
      second.allMonsters.length,
    );
    assert.equal(second.character, character);
    assert.equal(second.character.stats.health, 13);
    assert.deepEqual(outcomes, [], "an intermediate portal must not finish the run");

    for (const cell of second.world.cells) cell.exit = false;
    second.world.at(second.player.col, second.player.row).exit = true;
    const timeBeforeFinalPortal = second.gameTime;
    environment.runFrame(200);

    assert.deepEqual(outcomes, ["escaped"]);
    assert.ok(game.getState().gameTime > timeBeforeFinalPortal);
  });
});

test("a blocked turn followed by attack breaks the wall in front of the hero", () => {
  withGameEnvironment((environment) => {
    const { game, state, outcomes } = createTestGame({
      speed: 10,
      health: 20,
      exitX: 4,
    });
    state.world.at(2, 0).wallRight = createWall({
      health: 5,
      defense: 2,
      impactWear: 1,
    });

    environment.target.dispatchEvent(keyEvent("keydown", "ArrowRight"));
    environment.target.dispatchEvent(keyEvent("keyup", "ArrowRight"));
    environment.target.dispatchEvent(keyEvent("keydown", "Space"));
    game.start();
    environment.runFrame();

    assert.equal(state.world.at(2, 0).wallRight, null);
    assert.equal(state.world.at(2, 0).objects[0].kind, "wall-rubble");
    assert.equal(state.player.facing, "right");
    assert.equal(state.player.col, 2, "attacking must not move the hero");
    assert.deepEqual(outcomes, []);

    environment.target.dispatchEvent(keyEvent("keydown", "ArrowRight"));
    environment.target.dispatchEvent(keyEvent("keyup", "ArrowRight"));
    environment.runFrame(200);
    assert.equal(state.player.col, 3, "background rubble must remain walkable");
    game.stop();
  });
});

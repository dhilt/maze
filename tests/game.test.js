import assert from "node:assert/strict";
import test from "node:test";

import { createAssetBundle } from "../src/assets/asset-pack.js";
import { KNIGHT_ASSET_PACK } from "../src/assets/packs/knight.js";
import { MEAT_MONSTER_ASSET_PACK } from "../src/assets/packs/meat-monster.js";
import { createGame } from "../src/game/game.js";
import { EXIT_PHASES } from "../src/world/exit.js";
import { createWall } from "../src/world/maze.js";
import { createCharacterFixture } from "./fixtures/character.js";

const TEST_CONFIG = Object.freeze({
  cellSize: 16,
  viewCols: 5,
  viewRows: 5,
  cameraMargin: 1,
  gameTime: Object.freeze({ secondsPerUnit: 0.1, speed: 1 }),
  debug: false,
  floorStyle: "stone",
  worldSeed: 11,
  wallDensity: 0,
  wallSeed: 17,
  baseWallHealth: 20,
  baseWallDefense: 2,
  wallImpactWear: 1,
});

const TEST_ACTION_COSTS = Object.freeze({
  step: 5,
  turn: 1,
  attack: 5,
  consume: 10,
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

function createTestAssets() {
  const image = { complete: false, naturalWidth: 0 };
  const bundles = new Map([
    KNIGHT_ASSET_PACK,
    MEAT_MONSTER_ASSET_PACK,
  ].map((pack) => [pack.id, createAssetBundle(pack, () => image)]));
  return {
    get(id) {
      const bundle = bundles.get(id);
      if (!bundle) throw new Error(`Unknown test asset pack: ${id}`);
      return bundle;
    },
  };
}

function createTestLevelBus(levels) {
  let index = 0;
  let completed = false;
  return {
    advance() {
      if (completed || index >= levels.length - 1) return false;
      index += 1;
      return true;
    },
    complete() {
      if (completed || index !== levels.length - 1) return false;
      completed = true;
      return true;
    },
    get current() { return levels[index]; },
    get isLast() { return index === levels.length - 1; },
    get state() {
      return {
        number: index + 1,
        total: levels.length,
        progress: completed ? 1 : (index + 1) / (levels.length + 1),
        isLast: index === levels.length - 1,
        isComplete: completed,
        definition: levels[index],
      };
    },
  };
}

function withGameEnvironment(run) {
  const previous = {
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };

  const target = new EventTarget();
  let nextFrame = null;
  let schedules = 0;
  let cancels = 0;

  globalThis.window = target;
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
  healthDrainSpeed = 100,
  exitX,
  exitY = 0,
  worldRows = 1,
  monsterCount = 0,
  levels,
  preserveGeneratedExit = false,
}) {
  const outcomes = [];
  const testLevels = levels ?? [{
    number: 1,
    width: 5,
    height: worldRows,
    monsterCount,
  }];
  const character = createCharacterFixture({
    name: "Integration Hero",
    stats: { health, attack: 7, defense: 5, morale: 8 },
    statsMax: { health: 20, attack: 7, defense: 5, morale: 10 },
    actionCosts: TEST_ACTION_COSTS,
    healthDrainSpeed,
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
    assets: createTestAssets(),
    levelBus: createTestLevelBus(testLevels),
    config: {
      ...TEST_CONFIG,
      gameTime: { ...TEST_CONFIG.gameTime, speed },
    },
    onFinish: (outcome) => outcomes.push(outcome),
  });

  const state = game.getState();
  for (const monster of state.monsters) {
    monster.attackEfficiency = 1;
    monster.defenseEfficiency = 1;
    Object.assign(monster.actionCosts, {
      step: TEST_ACTION_COSTS.step,
      turn: TEST_ACTION_COSTS.turn,
      attack: TEST_ACTION_COSTS.attack,
    });
  }
  if (!preserveGeneratedExit) {
    for (const cell of state.world.cells) cell.exit = null;
    state.world.at(exitX, exitY).exit = {
      kind: "exit",
      phase: EXIT_PHASES.OPEN,
    };
  }
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

test("a player victory starts the portal's own reveal duration", () => {
  withGameEnvironment((environment) => {
    const { game, state, outcomes } = createTestGame({
      speed: 2.5,
      health: 20,
      worldRows: 3,
      monsterCount: 1,
      preserveGeneratedExit: true,
    });
    const exitCell = state.exitCell;
    assert.equal(exitCell, state.world.at(exitCell.x, exitCell.y));
    const monster = state.monsters[0];
    state.player.facing = "right";
    monster.col = state.player.col + 1;
    monster.row = state.player.row;
    monster.facing = "left";
    Object.assign(monster.stats, { health: 2, attack: 0, defense: 5 });

    assert.equal(exitCell.exit.phase, EXIT_PHASES.HIDDEN);
    environment.target.dispatchEvent(keyEvent("keydown", "Space"));
    game.start();
    environment.runFrame();

    assert.equal(monster.stats.health, 0);
    assert.equal(exitCell.exit.phase, EXIT_PHASES.REVEALING);
    assert.equal(exitCell.exit.revealStartedAt, 2.5);
    assert.deepEqual(outcomes, []);

    state.player.col = exitCell.x;
    state.player.row = exitCell.y;
    environment.target.dispatchEvent(keyEvent("keyup", "Space"));
    environment.runFrame(200);
    assert.equal(exitCell.exit.phase, EXIT_PHASES.REVEALING);
    assert.deepEqual(outcomes, [], "a revealing portal is not usable yet");

    let frameOffsetMs = 300;
    for (let guard = 0; guard < 10 && exitCell.exit.phase === EXIT_PHASES.REVEALING; guard++) {
      environment.runFrame(frameOffsetMs);
      frameOffsetMs += 100;
    }
    assert.equal(exitCell.exit.phase, EXIT_PHASES.OPEN);
    assert.deepEqual(outcomes, ["escaped"]);
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
    monster.carcass.nutrition = 6;
    monster.carcass.moraleCost = 2;
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
      timeCost: monster.actionCosts.step,
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
    state.player.facing = "right";

    environment.target.dispatchEvent(keyEvent("keydown", "ArrowRight"));
    game.start();
    environment.runFrame();

    assert.equal(state.character.stats.health, 20);
    assert.equal(state.player.col, 3);
    assert.deepEqual(outcomes, ["escaped"]);
  });
});

test("a direction tap turns in place while holding continues into movement", () => {
  withGameEnvironment((environment) => {
    const { game, state } = createTestGame({
      speed: 10,
      health: 20,
      exitX: 0,
    });

    environment.target.dispatchEvent(keyEvent("keydown", "ArrowRight"));
    game.start();
    environment.runFrame(100);

    assert.equal(state.player.facing, "right");
    assert.equal(state.player.col, 2, "the initial press only turns before hold is confirmed");

    environment.runFrame(200);
    assert.ok(state.player.col > 2, "the held direction starts movement after its delay");

    environment.target.dispatchEvent(keyEvent("keyup", "ArrowRight"));
    game.stop();
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
    assert.equal(second.level.isComplete, false);
    assert.ok(second.level.progress < 1);
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

    for (const cell of second.world.cells) cell.exit = null;
    second.world.at(second.player.col, second.player.row).exit = {
      kind: "exit",
      phase: EXIT_PHASES.OPEN,
    };
    const timeBeforeFinalPortal = second.gameTime;
    environment.runFrame(200);

    assert.deepEqual(outcomes, ["escaped"]);
    const completed = game.getState();
    assert.ok(completed.gameTime > timeBeforeFinalPortal);
    assert.equal(completed.level.isComplete, true);
    assert.equal(completed.level.progress, 1);
  });
});

test("advancing a level resets accumulated health drain", () => {
  withGameEnvironment((environment) => {
    const { game, state: first } = createTestGame({
      speed: 1,
      health: 13,
      healthDrainSpeed: 2,
      exitX: 2,
      levels: [
        { number: 1, width: 5, height: 1, monsterCount: 0 },
        { number: 2, width: 10, height: 1, monsterCount: 0 },
      ],
    });

    game.start();
    environment.runFrame(); // one unit accumulates before entering level 2
    assert.equal(game.getState().level.number, 2);

    environment.runFrame(200);
    assert.equal(first.character.stats.health, 13);

    environment.runFrame(300);
    assert.equal(first.character.stats.health, 12);
    game.stop();
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

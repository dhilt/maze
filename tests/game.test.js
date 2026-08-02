import assert from "node:assert/strict";
import test from "node:test";

import { GAME_CONFIG } from "../src/config.js";
import { createGame } from "../src/game/game.js";

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

function createTestGame({ speed, health, exitX }) {
  const outcomes = [];
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
    config: {
      ...GAME_CONFIG,
      worldCols: 5,
      worldRows: 1,
      wallDensity: 0,
      wallSeed: 1,
      gameTime: { ...GAME_CONFIG.gameTime, speed },
    },
    onFinish: (outcome) => outcomes.push(outcome),
  });

  const state = game.getState();
  state.character.stats.health = health;
  for (const cell of state.world.cells) cell.exit = false;
  state.world.at(exitX, 0).exit = true;
  return { game, state, outcomes };
}

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

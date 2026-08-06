import assert from "node:assert/strict";
import test from "node:test";

import { GAME_CONFIG } from "../src/config.js";
import { createGameTime } from "../src/game/time.js";

const near = (a, b) => Math.abs(a - b) < 1e-9;

test("configured game time satisfies its runtime invariants", () => {
  assert.ok(Number.isFinite(GAME_CONFIG.gameTime.secondsPerUnit));
  assert.ok(GAME_CONFIG.gameTime.secondsPerUnit > 0);
  assert.ok(Number.isFinite(GAME_CONFIG.gameTime.speed));
  assert.ok(GAME_CONFIG.gameTime.speed > 0);
});

test("game time converts physical seconds into logical units", () => {
  const gameTime = createGameTime({ secondsPerUnit: 0.1, speed: 1 });
  const tick = gameTime.advance({ dt: 0.05, time: 2.5, timestamp: 2500 });

  assert.ok(near(tick.dt, 0.5));
  assert.ok(near(tick.time, 0.5));
  assert.equal(tick.realDt, 0.05);
  assert.equal(tick.realTime, 2.5);
  assert.equal(tick.realTimestamp, 2500);
});

test("global game time accumulates independently from physical time", () => {
  const gameTime = createGameTime({ secondsPerUnit: 0.1, speed: 1 });
  gameTime.advance({ dt: 0.02, time: 0.02 });
  const tick = gameTime.advance({ dt: 0.08, time: 0.1 });

  assert.ok(near(tick.dt, 0.8));
  assert.ok(near(tick.time, 1));
  assert.ok(near(gameTime.time, 1));
});

test("game speed scales logical time without changing the physical tick", () => {
  const gameTime = createGameTime({ secondsPerUnit: 0.1, speed: 2 });
  const tick = gameTime.advance({ dt: 0.05, time: 0.05 });

  assert.ok(near(tick.dt, 1));
  assert.equal(tick.realDt, 0.05);
});

test("game time rejects invalid scales and deltas", () => {
  assert.throws(() => createGameTime({ secondsPerUnit: 0 }), /secondsPerUnit/);
  assert.throws(() => createGameTime({ secondsPerUnit: 0.1, speed: -1 }), /speed/);

  const gameTime = createGameTime({ secondsPerUnit: 0.1, speed: 1 });
  assert.throws(() => gameTime.advance({ dt: -0.01, time: 0 }), /realTick.dt/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createHealthDrain } from "../src/game/health-drain.js";

test("loses 1 health per interval and carries the remainder", () => {
  const character = createCharacter({
    stats: { health: 20 },
    healthDrainSpeed: 100,
  });
  const drain = createHealthDrain({ character });

  assert.equal(drain.advance(60), 0); // accumulates, no tick yet
  assert.equal(character.stats.health, 20);

  assert.equal(drain.advance(60), 1); // 120 units → one tick, 20 carried
  assert.equal(character.stats.health, 19);

  assert.equal(drain.advance(250), 2); // 20 + 250 = 270 → two ticks, 70 carried
  assert.equal(character.stats.health, 17);

  assert.equal(drain.advance(30), 1); // the carried 70 reaches the next boundary
  assert.equal(character.stats.health, 16);
});

test("uses the character health drain speed", () => {
  const character = createCharacter({
    stats: { health: 20 },
    healthDrainSpeed: 10,
  });
  const drain = createHealthDrain({ character });

  assert.equal(drain.interval, 10);
  drain.advance(10);
  assert.equal(character.stats.health, 19);
});

test("a non-positive health drain speed disables the drain", () => {
  const character = createCharacter({
    stats: { health: 20 },
    healthDrainSpeed: 0,
  });
  const drain = createHealthDrain({ character });

  assert.equal(drain.advance(1000), 0);
  assert.equal(character.stats.health, 20);
});

test("remaining reports the fraction of the interval left and resets on a tick", () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const character = createCharacter({
    stats: { health: 20 },
    healthDrainSpeed: 100,
  });
  const drain = createHealthDrain({ character });

  assert.ok(near(drain.remaining, 1)); // full right after start
  drain.advance(25);
  assert.ok(near(drain.remaining, 0.75)); // drained a quarter
  drain.advance(75); // reaches 100 → tick, accumulator resets
  assert.ok(near(drain.remaining, 1));
  assert.equal(character.stats.health, 19);
});

test("health never drops below zero", () => {
  const character = createCharacter({
    stats: { health: 1 },
    healthDrainSpeed: 10,
  });
  const drain = createHealthDrain({ character });

  assert.equal(drain.advance(1000), 1); // only one tick lands before death
  assert.equal(character.stats.health, 0);
  assert.equal(drain.advance(1000), 0); // dead → no further drain
});

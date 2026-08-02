import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createHealthDrain } from "../src/game/health-drain.js";

test("loses 1 health per interval and carries the remainder", () => {
  const character = createCharacter({ health: 20 });
  const drain = createHealthDrain({ character, defaultInterval: 100 });

  assert.equal(drain.advance(60), 0); // accumulates, no tick yet
  assert.equal(character.health, 20);

  assert.equal(drain.advance(60), 1); // 120 units → one tick, 20 carried
  assert.equal(character.health, 19);

  assert.equal(drain.advance(250), 2); // 20 + 250 = 270 → two ticks, 70 carried
  assert.equal(character.health, 17);
});

test("a character interval overrides the config default", () => {
  const character = createCharacter({ health: 20, healthDrainInterval: 10 });
  const drain = createHealthDrain({ character, defaultInterval: 100 });

  assert.equal(drain.interval, 10);
  drain.advance(10);
  assert.equal(character.health, 19);
});

test("a non-positive interval disables the drain", () => {
  const character = createCharacter({ health: 20, healthDrainInterval: 0 });
  const drain = createHealthDrain({ character, defaultInterval: 100 });

  assert.equal(drain.advance(1000), 0);
  assert.equal(character.health, 20);
});

test("health never drops below zero", () => {
  const character = createCharacter({ health: 1, healthDrainInterval: 10 });
  const drain = createHealthDrain({ character, defaultInterval: 100 });

  assert.equal(drain.advance(1000), 1); // only one tick lands before death
  assert.equal(character.health, 0);
  assert.equal(drain.advance(1000), 0); // dead → no further drain
});

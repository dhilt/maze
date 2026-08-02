import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter, damage, heal } from "../src/entities/character.js";

test("creates a character with nested current and maximum stats", () => {
  const character = createCharacter();

  assert.equal(character.name, "Sir Roland");
  assert.deepEqual(character.stats, {
    health: 20,
    attack: 7,
    defense: 5,
    morale: 8,
  });
  assert.deepEqual(character.statsMax, {
    health: 20,
    attack: 7,
    defense: 5,
    morale: 10,
  });
  assert.equal(character.healthDrainSpeed, 100);
});

test("merges partial stat overrides without dropping other defaults", () => {
  const character = createCharacter({
    name: "Sir Test",
    stats: { health: 5 },
    statsMax: { health: 30 },
    healthDrainSpeed: 50,
  });

  assert.equal(character.name, "Sir Test");
  assert.deepEqual(character.stats, {
    health: 5,
    attack: 7,
    defense: 5,
    morale: 8,
  });
  assert.deepEqual(character.statsMax, {
    health: 30,
    attack: 7,
    defense: 5,
    morale: 10,
  });
  assert.equal(character.healthDrainSpeed, 50);
});

test("damage and healing clamp nested health", () => {
  const character = createCharacter({
    stats: { health: 5 },
    statsMax: { health: 8 },
  });

  damage(character, 10);
  assert.equal(character.stats.health, 0);

  heal(character, 20);
  assert.equal(character.stats.health, 8);
});

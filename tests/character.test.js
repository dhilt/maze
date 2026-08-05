import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter, damage, heal } from "../src/entities/character.js";

test("creates a character with nested current and maximum stats", () => {
  const character = createCharacter();

  assert.equal(typeof character.name, "string");
  assert.ok(character.name.length > 0);
  assert.deepEqual(Object.keys(character.stats), ["health", "attack", "defense", "morale"]);
  assert.deepEqual(Object.keys(character.statsMax), ["health", "attack", "defense", "morale"]);
  assert.notEqual(character.stats, character.statsMax);
  for (const stat of Object.keys(character.stats)) {
    assert.ok(Number.isFinite(character.stats[stat]));
    assert.ok(character.stats[stat] >= 0);
    assert.ok(Number.isFinite(character.statsMax[stat]));
    assert.ok(character.statsMax[stat] >= character.stats[stat]);
  }
  assert.ok(Number.isFinite(character.healthDrainSpeed));
  assert.ok(character.healthDrainSpeed > 0);
  for (const cost of Object.values(character.actionCosts)) {
    assert.ok(Number.isInteger(cost));
    assert.ok(cost > 0);
  }
});

test("merges partial stat overrides without dropping other defaults", () => {
  const baseline = createCharacter();
  const character = createCharacter({
    name: "Sir Test",
    stats: { health: 5 },
    statsMax: { health: 30 },
    actionCosts: { step: 3 },
    healthDrainSpeed: 50,
  });

  assert.equal(character.name, "Sir Test");
  assert.equal(character.stats.health, 5);
  assert.equal(character.statsMax.health, 30);
  for (const stat of ["attack", "defense", "morale"]) {
    assert.equal(character.stats[stat], baseline.stats[stat]);
    assert.equal(character.statsMax[stat], baseline.statsMax[stat]);
  }
  assert.equal(character.actionCosts.step, 3);
  for (const action of ["turn", "attack", "consume"]) {
    assert.equal(character.actionCosts[action], baseline.actionCosts[action]);
  }
  assert.equal(character.healthDrainSpeed, 50);
});

test("characters own independent action costs", () => {
  const first = createCharacter({ actionCosts: { step: 3 } });
  const second = createCharacter({ actionCosts: { step: 7 } });

  assert.notEqual(first.actionCosts, second.actionCosts);
  assert.equal(first.actionCosts.step, 3);
  assert.equal(second.actionCosts.step, 7);
  assert.throws(
    () => createCharacter({ actionCosts: { attack: 0 } }),
    /attack action cost/,
  );
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

import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter, damage, heal } from "../src/entities/character.js";

test("creates an independent production character", () => {
  const first = createCharacter({ name: "First" });
  const second = createCharacter({ name: "Second" });

  assert.equal(first.name, "First");
  assert.equal(second.name, "Second");
  assert.notEqual(first.stats, second.stats);
  assert.notEqual(first.statsMax, second.statsMax);
  assert.notEqual(first.actionCosts, second.actionCosts);

  for (const stats of [first.stats, first.statsMax]) {
    for (const value of Object.values(stats)) {
      assert.ok(Number.isFinite(value));
      assert.ok(value >= 0);
    }
  }
  for (const efficiency of [first.attackEfficiency, first.defenseEfficiency]) {
    assert.ok(Number.isFinite(efficiency));
    assert.ok(efficiency >= 0 && efficiency <= 1);
  }
  for (const cost of Object.values(first.actionCosts)) {
    assert.ok(Number.isInteger(cost));
    assert.ok(cost > 0);
  }
});

test("damage and healing clamp nested health", () => {
  const character = createCharacter({ name: "Test Hero" });
  character.stats.health = 5;
  character.statsMax.health = 8;

  damage(character, 10);
  assert.equal(character.stats.health, 0);

  heal(character, 20);
  assert.equal(character.stats.health, 8);
});

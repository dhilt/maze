import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createConsume } from "../src/game/actions/consume.js";
import { generateWorld } from "../src/world/world.js";

function setup({
  health = 15,
  morale = 2,
  nutrition = 7,
  moraleCost = 3,
  entityExists = true,
} = {}) {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  const character = createCharacter({ stats: { health, morale } });
  const monster = { id: "m1", nutrition, moraleCost };
  const corpse = {
    id: "corpse-m1",
    kind: "corpse",
    layer: "background",
    entityId: monster.id,
  };
  world.at(0, 0).objects.push(corpse);
  const changes = [];
  const consume = createConsume({
    world,
    character,
    findEntityById: (id) => (entityExists && id === monster.id ? monster : null),
    onStatChange: (change) => changes.push(change),
  });
  return { world, character, monster, corpse, changes, consume };
}

test("consume applies nutrition and morale cost only when the action completes", () => {
  const { world, character, changes, consume } = setup();
  consume.begin({
    kind: "consume",
    timeCost: 10,
    target: { col: 0, row: 0, corpseId: "corpse-m1", entityId: "m1" },
  });

  assert.equal(consume.update(9), 0);
  assert.equal(character.stats.health, 15);
  assert.equal(character.stats.morale, 2);
  assert.equal(world.at(0, 0).objects.length, 1);

  assert.equal(consume.update(2), 1);
  assert.equal(character.stats.health, 20, "nutrition is capped by maximum health");
  assert.equal(character.stats.morale, 0, "the last meal may reduce morale to zero");
  assert.deepEqual(world.at(0, 0).objects, []);
  assert.deepEqual(changes, [{ healthGained: 5, moraleLost: 2, entityId: "m1" }]);
  assert.equal(consume.active, false);
});

test("consume leaves state unchanged when its linked entity no longer exists", () => {
  const { world, character, changes, consume } = setup({ entityExists: false });
  consume.begin({
    kind: "consume",
    timeCost: 10,
    target: { col: 0, row: 0, corpseId: "corpse-m1", entityId: "m1" },
  });

  consume.update(10);

  assert.equal(character.stats.health, 15);
  assert.equal(character.stats.morale, 2);
  assert.equal(world.at(0, 0).objects.length, 1);
  assert.deepEqual(changes, []);
});

import assert from "node:assert/strict";
import test from "node:test";

import { placeCorpse } from "../src/world/corpse.js";
import { generateWorld } from "../src/world/world.js";
import { createMeatMonsterFixture } from "./fixtures/meat-monster.js";

test("a death without a hit cell leaves a serialisable corpse in the occupied cell", () => {
  const world = generateWorld({ width: 3, height: 1, seed: 1 });
  const monster = createMeatMonsterFixture({
    id: "m1",
    col: 2,
    row: 0,
    facing: "left",
  });
  monster.move = { kind: "step", dx: -1, dy: 0, elapsed: 2, timeCost: 8 };

  const corpse = placeCorpse(world, monster);

  assert.deepEqual(corpse, {
    id: "corpse-m1",
    kind: "corpse",
    layer: "background",
    entityId: "m1",
  });
  assert.deepEqual(world.at(1, 0).objects, [corpse]);
  assert.deepEqual(world.at(2, 0).objects, []);
  assert.doesNotThrow(() => JSON.stringify(world.cells));
});

test("a lethal hit cell takes precedence over a moving monster's destination", () => {
  const world = generateWorld({ width: 4, height: 1, seed: 1 });
  const monster = createMeatMonsterFixture({ id: "m2", col: 1, row: 0 });
  monster.move = { kind: "step", dx: 1, dy: 0, elapsed: 1, timeCost: 16 };

  const corpse = placeCorpse(world, monster, { col: 1, row: 0 });

  assert.deepEqual(world.at(1, 0).objects, [corpse]);
  assert.deepEqual(world.at(2, 0).objects, []);
});

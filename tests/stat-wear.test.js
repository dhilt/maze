import assert from "node:assert/strict";
import test from "node:test";

import { createStatWear } from "../src/game/stat-wear.js";

test("100 wear units consume one character stat point", () => {
  const character = { stats: { attack: 3 } };
  const wear = createStatWear({ character });

  assert.deepEqual(wear.apply("attack", 40), {
    stat: "attack",
    lost: 0,
    remaining: 0.6,
  });
  assert.deepEqual(wear.apply("attack", 70), {
    stat: "attack",
    lost: 1,
    remaining: 0.9,
  });
  assert.equal(character.stats.attack, 2);
});

test("the same wear accumulator can degrade Defense", () => {
  const character = { stats: { attack: 9, defense: 4 } };
  const wear = createStatWear({ character });

  wear.apply("defense", 250);

  assert.equal(character.stats.defense, 2);
  assert.equal(wear.remaining("defense"), 0.5);
  assert.equal(character.stats.attack, 9);
  assert.equal(wear.remaining("attack"), 1);
});

test("wear clamps a stat at zero and removes its remainder", () => {
  const character = { stats: { attack: 1 } };
  const wear = createStatWear({ character });

  assert.deepEqual(wear.apply("attack", 250), {
    stat: "attack",
    lost: 1,
    remaining: 0,
  });
  assert.equal(character.stats.attack, 0);
});

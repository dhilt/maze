import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createStatWear } from "../src/game/stat-wear.js";

test("100 wear units consume one character stat point", () => {
  const character = createCharacter();
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
  assert.equal(character.stats.attack, 6);
});

test("the same wear accumulator can degrade Defense", () => {
  const character = createCharacter();
  const wear = createStatWear({ character });

  wear.apply("defense", 250);

  assert.equal(character.stats.defense, 3);
  assert.equal(wear.remaining("defense"), 0.5);
  assert.equal(character.stats.attack, 7);
  assert.equal(wear.remaining("attack"), 1);
});

test("wear clamps a stat at zero and removes its remainder", () => {
  const character = createCharacter({ stats: { attack: 1 } });
  const wear = createStatWear({ character });

  assert.deepEqual(wear.apply("attack", 250), {
    stat: "attack",
    lost: 1,
    remaining: 0,
  });
  assert.equal(character.stats.attack, 0);
});

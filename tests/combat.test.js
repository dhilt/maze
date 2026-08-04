import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createMeatMonster } from "../src/entities/meat-monster.js";
import { createCombat } from "../src/game/combat.js";

function monsterAt({ id = "monster-1", health = 20, attack = 7, defense = 5 } = {}) {
  const monster = createMeatMonster({ id, col: 1, row: 0, facing: "left" });
  Object.assign(monster.stats, { health, attack, defense });
  Object.assign(monster.statsMax, { health, attack, defense });
  return monster;
}

function duel({ heroHealth = 20, monsterHealth = 20 } = {}) {
  const player = { col: 0, row: 0 };
  const character = createCharacter({
    stats: { health: heroHealth, attack: 7, defense: 5 },
    statsMax: { health: heroHealth },
  });
  const monster = monsterAt({ health: monsterHealth });
  const monsters = [monster];
  const combat = createCombat({ player, character, monsters });
  return { player, character, monster, monsters, combat };
}

const heroHit = (at = 5) => ({
  at,
  attacker: { type: "player" },
  targetCell: { col: 1, row: 0 },
});

const monsterHit = (at = 5) => ({
  at,
  attacker: { type: "entity", id: "monster-1" },
  targetCell: { col: 0, row: 0 },
});

test("equal-time attacks damage both combatants from one snapshot", () => {
  const { character, monster, combat } = duel();
  combat.queueImpact(heroHit());
  combat.queueImpact(monsterHit());

  const result = combat.resolve();

  assert.equal(character.stats.health, 18);
  assert.equal(monster.stats.health, 18);
  assert.equal(result.impacts.length, 2);
});

test("mutual death is possible when contacts happen at the same time", () => {
  const { character, monsters, combat } = duel({ heroHealth: 2, monsterHealth: 2 });
  combat.queueImpact(heroHit());
  combat.queueImpact(monsterHit());

  const result = combat.resolve();

  assert.equal(character.stats.health, 0);
  assert.deepEqual(result.deadMonsterIds, ["monster-1"]);
  assert.equal(monsters.length, 0);
});

test("an earlier lethal hit cancels the defeated attacker's later contact", () => {
  const { character, monsters, combat } = duel({ heroHealth: 2, monsterHealth: 2 });
  combat.queueImpact(monsterHit(2));
  combat.queueImpact(heroHit(1));

  const result = combat.resolve();

  assert.equal(character.stats.health, 2);
  assert.equal(result.impacts.length, 1);
  assert.equal(monsters.length, 0);
});

test("an entity attack misses after its target leaves the attacked cell", () => {
  const { monster, combat } = duel();
  combat.queueImpact(heroHit());
  monster.col = 2;

  const result = combat.resolve();

  assert.equal(monster.stats.health, 20);
  assert.equal(result.impacts.length, 0);
});

test("a reserved movement cell defines where a moving target can be hit", () => {
  const { player, character, monster, monsters } = duel();
  monster.move = { kind: "step", dx: 1, dy: 0, elapsed: 1, timeCost: 5 };
  const combat = createCombat({ player, character, monsters });
  combat.queueImpact(heroHit());

  const result = combat.resolve();

  assert.equal(monster.stats.health, 20);
  assert.equal(result.impacts.length, 0);
});

test("a cell attack hits a one-sided moving target that enters its active window", () => {
  const { character, monster, combat } = duel();
  const strike = { hitResolved: false };
  monster.col = 2;
  combat.queueImpact({
    at: 2.5,
    attacker: { type: "player" },
    targetCell: { col: 1, row: 0 },
    strike,
  });

  assert.equal(combat.resolve().impacts.length, 0, "the empty cell is not a locked target");
  assert.equal(strike.hitResolved, false);

  monster.move = { kind: "step", dx: -1, dy: 0, elapsed: 1, timeCost: 5 };
  combat.queueImpact({
    at: 2.8,
    attacker: { type: "player" },
    targetCell: { col: 1, row: 0 },
    strike,
  });
  const result = combat.resolve();

  assert.equal(monster.stats.health, 18);
  assert.equal(character.stats.health, 20, "a hit does not create an automatic counterattack");
  assert.equal(strike.hitResolved, true);
  assert.equal(result.impacts.length, 1);
});

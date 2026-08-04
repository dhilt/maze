import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter } from "../src/entities/character.js";
import { createMeatMonster } from "../src/entities/meat-monster.js";
import { createCombat } from "../src/game/combat.js";
import { createStatWear } from "../src/game/stat-wear.js";

function monsterAt({
  id = "monster-1",
  health = 20,
  attack = 7,
  defense = 5,
  morale = 3,
  impactWear = 1,
} = {}) {
  const monster = createMeatMonster({ id, col: 1, row: 0, facing: "left" });
  Object.assign(monster.stats, { health, attack, defense, morale });
  Object.assign(monster.statsMax, { health, attack, defense, morale });
  monster.impactWear = impactWear;
  return monster;
}

function duel({
  heroHealth = 20,
  heroMorale = 4,
  heroMoraleMax = 10,
  monsterHealth = 20,
  monsterMorale = 3,
} = {}) {
  const player = { col: 0, row: 0 };
  const character = createCharacter({
    stats: { health: heroHealth, attack: 7, defense: 5, morale: heroMorale },
    statsMax: { health: heroHealth, morale: heroMoraleMax },
  });
  const monster = monsterAt({ health: monsterHealth, morale: monsterMorale });
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
  assert.equal(monsters.length, 1, "dead entities remain available as history");
  assert.equal(monsters[0].stats.health, 0);
});

test("a player kill restores the defeated monster's morale value", () => {
  const { player, character, monster, monsters } = duel({
    heroMorale: 4,
    heroMoraleMax: 10,
    monsterHealth: 2,
    monsterMorale: 3,
  });
  const changes = [];
  const combat = createCombat({
    player,
    character,
    monsters,
    onPlayerStatChange: (change) => changes.push(change),
  });

  combat.queueImpact(heroHit());
  combat.resolve();
  combat.resolve();

  assert.equal(character.stats.morale, 7);
  assert.deepEqual(changes, [{ stat: "morale", gained: 3, sourceId: monster.id }]);
});

test("kill morale is capped by the hero's maximum and ignores unrelated deaths", () => {
  const { player, character, monster, monsters } = duel({
    heroMorale: 9,
    heroMoraleMax: 10,
    monsterHealth: 2,
    monsterMorale: 3,
  });
  const changes = [];
  const combat = createCombat({
    player,
    character,
    monsters,
    onPlayerStatChange: (change) => changes.push(change),
  });

  combat.queueImpact(heroHit());
  combat.resolve();
  assert.equal(character.stats.morale, 10);
  assert.deepEqual(changes, [{ stat: "morale", gained: 1, sourceId: monster.id }]);

  const unrelated = monsterAt({ id: "unrelated", health: 0, morale: 9 });
  monsters.push(unrelated);
  combat.resolve();
  assert.equal(character.stats.morale, 10);
  assert.equal(changes.length, 1);
});

test("an earlier lethal hit cancels the defeated attacker's later contact", () => {
  const { character, monsters, combat } = duel({ heroHealth: 2, monsterHealth: 2 });
  combat.queueImpact(monsterHit(2));
  combat.queueImpact(heroHit(1));

  const result = combat.resolve();

  assert.equal(character.stats.health, 2);
  assert.equal(result.impacts.length, 1);
  assert.equal(monsters.length, 1);
  assert.equal(monsters[0].stats.health, 0);
});

test("a preserved dead monster emits its death event only once", () => {
  const { player, character, monster, monsters } = duel({ monsterHealth: 2 });
  const deaths = [];
  const combat = createCombat({
    player,
    character,
    monsters,
    onMonsterDeath: (dead) => deaths.push(dead.id),
  });
  combat.queueImpact(heroHit());

  assert.deepEqual(combat.resolve().deadMonsterIds, [monster.id]);
  assert.deepEqual(combat.resolve().deadMonsterIds, []);
  assert.deepEqual(deaths, [monster.id]);
  assert.equal(monsters[0], monster);
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

test("successful entity hits lightly wear the hero's Attack while misses do not", () => {
  const { player, character, monster, monsters } = duel();
  const statWear = createStatWear({ character });
  const statChanges = [];
  const combat = createCombat({
    player,
    character,
    monsters,
    statWear,
    onPlayerStatChange: (change) => statChanges.push(change),
  });

  monster.col = 2;
  combat.queueImpact(heroHit());
  combat.resolve();
  assert.equal(statWear.remaining("attack"), 1, "an empty target cell causes no wear");

  monster.col = 1;
  combat.queueImpact(heroHit());
  combat.resolve();
  assert.equal(statWear.remaining("attack"), 0.85);
  assert.equal(character.stats.attack, 7);

  statWear.apply("attack", 70);
  combat.queueImpact(heroHit());
  combat.resolve();
  assert.equal(character.stats.attack, 6);
  assert.deepEqual(statChanges, [{ stat: "attack", lost: 1, remaining: 1 }]);
});

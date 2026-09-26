import assert from "node:assert/strict";
import test from "node:test";

import { createStatWear } from "../src/game/stat-wear.js";
import { createCharacterFixture } from "./fixtures/character.js";
import { createCombatFixture } from "./fixtures/combat.js";
import { createMeatMonsterFixture } from "./fixtures/meat-monster.js";

const MID_ROLL = () => 0.5;

function monsterAt({
  id = "monster-1",
  health = 20,
  attack = 7,
  defense = 5,
  moraleReward = 3,
  impactWear = 1,
  attackEfficiency = 1,
  defenseEfficiency = 1,
} = {}) {
  return createMeatMonsterFixture({
    id,
    col: 1,
    row: 0,
    facing: "left",
    stats: { health, attack, defense },
    moraleReward,
    impactWear,
    attackEfficiency,
    defenseEfficiency,
  });
}

function duel({
  heroHealth = 20,
  heroMorale = 4,
  heroMoraleMax = 10,
  monsterHealth = 20,
  monsterMoraleReward = 3,
} = {}) {
  const player = { col: 0, row: 0 };
  const character = createCharacterFixture({
    stats: { health: heroHealth, attack: 7, defense: 5, morale: heroMorale },
    statsMax: { health: heroHealth, morale: heroMoraleMax },
  });
  const monster = monsterAt({ health: monsterHealth, moraleReward: monsterMoraleReward });
  const monsters = [monster];
  const combat = createCombatFixture({
    player,
    character,
    monsters,
    damageRoll: MID_ROLL,
  });
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
  assert.deepEqual(result.healthLosses.map(({ target, amount }) => [target.type, amount]), [
    ["entity", 2],
    ["player", 2],
  ]);
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

test("a combat hit reports only health actually lost, including overkill", () => {
  const { monster, combat } = duel({ monsterHealth: 1 });
  combat.queueImpact(heroHit());

  const result = combat.resolve();

  assert.equal(monster.stats.health, 0);
  assert.equal(result.impacts[0].damage, 2);
  assert.deepEqual(result.healthLosses, [{
    at: 5,
    attacker: { type: "player" },
    target: { type: "entity", id: monster.id },
    amount: 1,
  }]);
  assert.deepEqual(combat.resolve().healthLosses, [], "the death does not emit a second hit");
});

test("a player kill grants the defeated monster's morale reward", () => {
  const { player, character, monster, monsters } = duel({
    heroMorale: 4,
    heroMoraleMax: 10,
    monsterHealth: 2,
    monsterMoraleReward: 3,
  });
  const changes = [];
  const combat = createCombatFixture({
    player,
    character,
    monsters,
    damageRoll: MID_ROLL,
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
    monsterMoraleReward: 3,
  });
  const changes = [];
  const combat = createCombatFixture({
    player,
    character,
    monsters,
    damageRoll: MID_ROLL,
    onPlayerStatChange: (change) => changes.push(change),
  });

  combat.queueImpact(heroHit());
  combat.resolve();
  assert.equal(character.stats.morale, 10);
  assert.deepEqual(changes, [{ stat: "morale", gained: 1, sourceId: monster.id }]);

  const unrelated = monsterAt({ id: "unrelated", health: 0, moraleReward: 9 });
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
  const combat = createCombatFixture({
    player,
    character,
    monsters,
    damageRoll: MID_ROLL,
    onMonsterDeath: ({ monster: dead, killer, at }) => {
      deaths.push({ id: dead.id, killer, at });
    },
  });
  combat.queueImpact(heroHit());

  assert.deepEqual(combat.resolve().deadMonsterIds, [monster.id]);
  assert.deepEqual(combat.resolve().deadMonsterIds, []);
  assert.deepEqual(deaths, [{ id: monster.id, killer: "player", at: 5 }]);
  assert.equal(monsters[0], monster);
});

test("multiple combat deaths are emitted in their impact-time order", () => {
  const player = { col: 0, row: 0 };
  const character = createCharacterFixture({
    stats: { attack: 7 },
    statsMax: { attack: 7 },
  });
  const late = monsterAt({ id: "late", health: 2 });
  const early = monsterAt({ id: "early", health: 2 });
  late.col = 1;
  early.col = 0;
  early.row = 1;
  const deaths = [];
  const combat = createCombatFixture({
    player,
    character,
    monsters: [late, early],
    damageRoll: MID_ROLL,
    onMonsterDeath: ({ monster, at }) => deaths.push([monster.id, at]),
  });
  combat.queueImpact({ ...heroHit(4), targetCell: { col: 1, row: 0 } });
  combat.queueImpact({ ...heroHit(1), targetCell: { col: 0, row: 1 } });

  combat.resolve();

  assert.deepEqual(deaths, [["early", 1], ["late", 4]]);
});

test("an entity attack misses after its target leaves the attacked cell", () => {
  const { monster, combat } = duel();
  combat.queueImpact(heroHit());
  monster.col = 2;

  const result = combat.resolve();

  assert.equal(monster.stats.health, 20);
  assert.equal(result.impacts.length, 0);
  assert.deepEqual(result.healthLosses, []);
});

test("a departing target stops being hittable after leaving sword reach", () => {
  const { player, character, monster, monsters } = duel();
  monster.move = { kind: "step", dx: 1, dy: 0, elapsed: 1, timeCost: 5 };
  const combat = createCombatFixture({
    player,
    character,
    monsters,
    damageRoll: MID_ROLL,
  });
  combat.queueImpact(heroHit());

  const result = combat.resolve();

  assert.equal(monster.stats.health, 20);
  assert.equal(result.impacts.length, 0);
});

test("a one-sided attack hits a moving target only when it comes within reach", () => {
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

  monster.move = { kind: "step", dx: -1, dy: 0, elapsed: 4.6, timeCost: 5 };
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
  assert.deepEqual(result.healthLosses[0].target, { type: "entity", id: monster.id });
});

test("approaching and retreating targets use visible distance in every direction", () => {
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of directions) {
    for (const [label, start, step, progress, expected] of [
      ["distant approach", 2, -1, 0.1, false],
      ["near approach", 2, -1, 0.95, true],
      ["near retreat", 1, 1, 0.05, true],
      ["distant retreat", 1, 1, 0.9, false],
    ]) {
      const player = { col: 2, row: 2 };
      const character = createCharacterFixture();
      const monster = createMeatMonsterFixture({
        col: player.col + dx * start,
        row: player.row + dy * start,
        move: {
          kind: "step",
          dx: dx * step,
          dy: dy * step,
          elapsed: progress * 10,
          timeCost: 10,
        },
      });
      const combat = createCombatFixture({ player, character, monsters: [monster] });
      combat.queueImpact({
        attacker: { type: "player" },
        targetCell: { col: player.col + dx, row: player.row + dy },
      });
      assert.equal(combat.resolve().impacts.length > 0, expected, `${label}: ${dx},${dy}`);
    }
  }
});

test("sideways targets can be hit on both sides of the attack axis", () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const sideX = -dy;
    const sideY = dx;
    for (const [label, start, step, progress, expected] of [
      ["early entry", -1, 1, 0.1, false],
      ["late entry", -1, 1, 0.9, true],
      ["early exit", 0, 1, 0.1, true],
      ["late exit", 0, 1, 0.9, false],
    ]) {
      const player = { col: 2, row: 2 };
      const character = createCharacterFixture();
      const monster = createMeatMonsterFixture({
        col: player.col + dx + sideX * start,
        row: player.row + dy + sideY * start,
        move: {
          kind: "step",
          dx: sideX * step,
          dy: sideY * step,
          elapsed: progress * 10,
          timeCost: 10,
        },
      });
      const combat = createCombatFixture({ player, character, monsters: [monster] });
      combat.queueImpact({
        attacker: { type: "player" },
        targetCell: { col: player.col + dx, row: player.row + dy },
      });
      assert.equal(combat.resolve().impacts.length > 0, expected, `${label}: ${dx},${dy}`);
    }
  }
});

test("monster attacks use the same continuous reach against a moving hero", () => {
  const player = { col: 0, row: 0 };
  const character = createCharacterFixture();
  const monster = createMeatMonsterFixture({ col: 2, row: 0, facing: "left" });
  const move = { kind: "step", dx: 1, dy: 0, elapsed: 1, timeCost: 10 };
  const combat = createCombatFixture({
    player,
    character,
    monsters: [monster],
    getPlayerMove: () => move,
  });
  const event = {
    attacker: { type: "entity", id: monster.id },
    targetCell: { col: 1, row: 0 },
  };

  combat.queueImpact(event);
  assert.equal(combat.resolve().impacts.length, 0);
  move.elapsed = 9.5;
  combat.queueImpact(event);
  assert.equal(combat.resolve().impacts.length, 1);
});

test("successful entity hits lightly wear the hero's Attack while misses do not", () => {
  const { player, character, monster, monsters } = duel();
  const statWear = createStatWear({ character });
  const statChanges = [];
  const combat = createCombatFixture({
    player,
    character,
    monsters,
    damageRoll: MID_ROLL,
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

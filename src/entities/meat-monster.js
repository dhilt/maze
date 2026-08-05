import { createActionCosts } from "../game/actions/action-costs.js";

const FACINGS = new Set(["up", "down", "left", "right"]);

export const MEAT_MONSTER_KIND = "meat-monster";
export const MEAT_MONSTER_DIRECTION_CHANGE_CHANCE = 0.2;
export const MEAT_MONSTER_MIN_NUTRITION = 4;
export const MEAT_MONSTER_MAX_NUTRITION = 7;
export const MEAT_MONSTER_MORALE_COST = 2;
export const MEAT_MONSTER_MORALE_REWARD = 1;
export const MEAT_MONSTER_IMPACT_WEAR = 0.05;

export const MEAT_MONSTER_MIN_STATS = Object.freeze({
  health: 17,
  attack: 5,
  defense: 3,
});

export const MEAT_MONSTER_MAX_STATS = Object.freeze({
  health: 23,
  attack: 7,
  defense: 5,
});

const DEFAULT_ACTION_COSTS = Object.freeze({
  step: 16,
  turn: 1,
  attack: 10,
});

export function createMeatMonsterStats(random) {
  const stats = {};
  for (const [name, min] of Object.entries(MEAT_MONSTER_MIN_STATS)) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
      throw new Error("Meat monster stat random must return a number in [0, 1)");
    }
    const max = MEAT_MONSTER_MAX_STATS[name];
    stats[name] = min + Math.floor(roll * (max - min + 1));
  }
  return stats;
}

function randomInteger(random, min, max, name) {
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error(`Meat monster ${name} random must return a number in [0, 1)`);
  }
  return min + Math.floor(roll * (max - min + 1));
}

export function createMeatMonster({
  id,
  col,
  row,
  facing = "down",
  random = Math.random,
  actionCosts = {},
}) {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("A meat monster requires a non-empty id");
  }
  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    throw new Error("Meat monster coordinates must be integers");
  }
  if (!FACINGS.has(facing)) {
    throw new Error(`Unknown meat monster facing: ${facing}`);
  }
  const concreteStats = createMeatMonsterStats(random);
  return {
    id,
    kind: MEAT_MONSTER_KIND,
    col,
    row,
    facing,
    stats: concreteStats,
    statsMax: { ...concreteStats },
    actionCosts: createActionCosts(DEFAULT_ACTION_COSTS, actionCosts),
    carcass: {
      nutrition: randomInteger(
        random,
        MEAT_MONSTER_MIN_NUTRITION,
        MEAT_MONSTER_MAX_NUTRITION,
        "nutrition",
      ),
      moraleCost: MEAT_MONSTER_MORALE_COST,
    },
    moraleReward: MEAT_MONSTER_MORALE_REWARD,
    impactWear: MEAT_MONSTER_IMPACT_WEAR,
    move: null,
    attack: null,
  };
}

import { createActionCosts } from "../game/actions/action-costs.js";

const DEFAULT_STATS = Object.freeze({
  health: 20,
  attack: 7,
  defense: 5,
  morale: 8,
});

const DEFAULT_STATS_MAX = Object.freeze({
  health: 20,
  attack: 7,
  defense: 5,
  morale: 10,
});

const DEFAULT_ACTION_COSTS = Object.freeze({
  step: 10,
  turn: 1,
  attack: 10,
  consume: 20,
});

export function createCharacter(overrides = {}) {
  const {
    stats = {},
    statsMax = {},
    actionCosts = {},
    ...characterOverrides
  } = overrides;

  return {
    name: "Hero",
    stats: { ...DEFAULT_STATS, ...stats },
    statsMax: { ...DEFAULT_STATS_MAX, ...statsMax },
    actionCosts: createActionCosts(DEFAULT_ACTION_COSTS, actionCosts),
    // Game-time units per -1 health tick. 0 or negative disables the drain.
    healthDrainSpeed: 400,
    ...characterOverrides,
  };
}

// Small helpers keep mutations clamped without turning the state into a class.
export function damage(ch, amount) {
  ch.stats.health = Math.max(0, ch.stats.health - amount);
  return ch;
}

export function heal(ch, amount) {
  ch.stats.health = Math.min(ch.statsMax.health, ch.stats.health + amount);
  return ch;
}

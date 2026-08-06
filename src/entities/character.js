export function createCharacter({ name }) {
  return {
    name,
    stats: {
      health: 30,
      attack: 7,
      defense: 5,
      morale: 8,
    },
    statsMax: {
      health: 30,
      attack: 7,
      defense: 5,
      morale: 10,
    },
    healthDrainSpeed: 400,
    actionCosts: {
      step: 10,
      turn: 1,
      attack: 9,
      consume: 20,
    },
    attackEfficiency: 0.6,
    defenseEfficiency: 0.6,
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

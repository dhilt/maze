export function createCharacterFixture({
  name = "Test Hero",
  stats = {},
  statsMax = {},
  actionCosts = {},
  healthDrainSpeed = 100,
  attackEfficiency = 1,
  defenseEfficiency = 1,
} = {}) {
  return {
    name,
    stats: {
      health: 20,
      attack: 7,
      defense: 5,
      morale: 8,
      ...stats,
    },
    statsMax: {
      health: 20,
      attack: 7,
      defense: 5,
      morale: 10,
      ...statsMax,
    },
    healthDrainSpeed,
    actionCosts: {
      step: 5,
      turn: 1,
      attack: 5,
      consume: 10,
      ...actionCosts,
    },
    attackEfficiency,
    defenseEfficiency,
  };
}

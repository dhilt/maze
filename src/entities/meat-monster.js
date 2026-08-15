function randomInteger(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function createMeatMonster({ id, col, row, facing, random }) {
  const stats = {
    health: randomInteger(random, 17, 23),
    attack: randomInteger(random, 5, 7),
    defense: randomInteger(random, 3, 5),
  };

  return {
    id,
    kind: "meat-monster",
    col,
    row,
    facing,
    stats,
    statsMax: { ...stats },
    actionCosts: {
      step: 16,
      turn: 1,
      attack: 10,
    },
    attackEfficiency: 0.33,
    defenseEfficiency: 0.33,
    carcass: {
      nutrition: randomInteger(random, 4, 7),
      moraleCost: 2,
    },
    moraleReward: 1,
    impactWear: 0.05,
    move: null,
    attack: null,
  };
}

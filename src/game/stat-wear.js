export const STAT_WEAR_PER_POINT = 100;

// Accumulates sub-point wear independently for every degradable character stat.
export function createStatWear({ character }) {
  const accumulated = new Map();

  function apply(stat, amount) {
    if (!(stat in character.stats)) throw new Error(`Unknown character stat: ${stat}`);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Stat wear must be a non-negative number");
    }
    if (amount === 0 || character.stats[stat] <= 0) {
      return { stat, lost: 0, remaining: remaining(stat) };
    }

    const total = (accumulated.get(stat) ?? 0) + amount;
    const requestedLoss = Math.floor(total / STAT_WEAR_PER_POINT);
    const lost = Math.min(character.stats[stat], requestedLoss);
    character.stats[stat] -= lost;

    if (character.stats[stat] <= 0) accumulated.delete(stat);
    else accumulated.set(stat, total % STAT_WEAR_PER_POINT);

    return { stat, lost, remaining: remaining(stat) };
  }

  function remaining(stat) {
    if (!(stat in character.stats)) throw new Error(`Unknown character stat: ${stat}`);
    if (character.stats[stat] <= 0) return 0;
    return 1 - (accumulated.get(stat) ?? 0) / STAT_WEAR_PER_POINT;
  }

  return { apply, remaining };
}

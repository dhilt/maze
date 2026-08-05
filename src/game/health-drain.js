import { damage } from "../entities/character.js";

// Game time drains health: every `healthDrainSpeed` game-time units the character
// loses 1 health. A non-positive speed disables the drain for that character.
export function createHealthDrain({ character }) {
  const interval = character.healthDrainSpeed;
  let accumulated = 0;

  // Advance by game-time units. Returns how much health was lost this call so the
  // caller can refresh the UI only when something actually changed.
  function advance(deltaUnits) {
    if (!(interval > 0) || character.stats.health <= 0) return 0;

    accumulated += deltaUnits;
    let lost = 0;
    while (accumulated >= interval && character.stats.health > 0) {
      accumulated -= interval;
      damage(character, 1);
      lost += 1;
    }
    return lost;
  }

  function reset() {
    accumulated = 0;
  }

  return {
    advance,
    reset,
    // Fraction of the current interval still remaining (1 = just ticked, 0 = due).
    // A disabled drain always reads full.
    get remaining() {
      if (!(interval > 0)) return 1;
      return Math.max(0, Math.min(1, 1 - accumulated / interval));
    },
  };
}

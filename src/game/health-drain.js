import { damage } from "../entities/character.js";

// Game time drains health: every `interval` game-time units the character loses
// 1 health. Real-time — it ticks whether or not the hero is acting. The interval
// comes from the character (healthDrainInterval) if set, else the config default;
// a non-positive interval disables the drain (the character is immune to time).
export function createHealthDrain({ character, defaultInterval }) {
  const interval = character.healthDrainInterval ?? defaultInterval;
  let accumulated = 0;

  // Advance by game-time units. Returns how much health was lost this call so the
  // caller can refresh the UI only when something actually changed.
  function advance(deltaUnits) {
    if (!(interval > 0) || character.health <= 0) return 0;

    accumulated += deltaUnits;
    let lost = 0;
    while (accumulated >= interval && character.health > 0) {
      accumulated -= interval;
      damage(character, 1);
      lost += 1;
    }
    return lost;
  }

  return {
    advance,
    get interval() { return interval; },
  };
}

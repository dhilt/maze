// Character model — the player's stats as a plain, serialisable state object.
//
// createCharacter() returns sensible defaults; pass overrides for any field.
// The object is intentionally flat data (no methods, JSON-serialisable) so it is
// trivial to store, pass around, save/load, or hand to the stats panel. Extend by
// adding a field here and a row in panel.js — nothing else needs to change.

export function createCharacter(overrides = {}) {
  return {
    name: "Sir Roland",
    health: 20,
    healthMax: 20,
    attack: 7,
    defense: 5,
    morale: 8,
    moraleMax: 10,
    ...overrides,
  };
}

// Small helpers keep mutations clamped without turning the state into a class.
export function damage(ch, amount) {
  ch.health = Math.max(0, ch.health - amount);
  return ch;
}

export function heal(ch, amount) {
  ch.health = Math.min(ch.healthMax, ch.health + amount);
  return ch;
}

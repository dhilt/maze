// Executes a concrete attack action produced by the adapter. Mirrors movement's
// begin()/update() contract in logical game-time units.
export function createAttack() {
  let state = null;

  function begin(resolved) {
    state = { elapsed: 0, timeCost: resolved.timeCost };
  }

  function update(deltaUnits) {
    if (!state) return 0;
    state.elapsed += deltaUnits;
    if (state.elapsed >= state.timeCost) {
      const leftover = state.elapsed - state.timeCost;
      state = null;
      return leftover;
    }
    return 0;
  }

  return {
    begin,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
